"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Tag } from "@phosphor-icons/react";
import type { PaginationMeta } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { getButtonClassName } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { ProductCard } from "@/components/products/product-card";
import { ArchiveProductModal } from "@/components/products/archive-product-modal";
import { useCatalogFilters } from "@/lib/hooks/use-catalog-filters";
import type { AdminProduct } from "@/lib/types/admin-catalog";

const STATUS_OPTIONS = [
  { value: "draft", label: "Borrador" },
  { value: "active", label: "Publicado" },
  { value: "archived", label: "Archivado" },
];

const CHANNEL_OPTIONS = [
  { value: "store", label: "Tienda" },
  { value: "subscription", label: "Suscripción" },
];

const PAGE_LIMIT = 24;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Milestone 2.2.1, Fase 3 — listado real de productos, diseño B aprobado
 * (ver git log de la sesión). El título de página ("Productos") ya lo pone
 * `TopBar` a partir de `nav-config.ts`; esta pantalla no lo repite.
 */
export default function ProductsPage() {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [channel, setChannel] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const { categoryOptions, categoriesById, badgesById } = useCatalogFilters();

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AdminProduct | null>(null);
  const [archiving, setArchiving] = useState(false);

  // Debounce del buscador: no hay razón para golpear la API en cada tecleo.
  // El reset a página 1 vive aquí (dentro del callback del timeout, no
  // síncrono en el cuerpo del efecto) porque un texto nuevo de búsqueda es
  // el único filtro que cambia sin pasar por un handler propio.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  const [retryKey, setRetryKey] = useState(0);

  // `fetchProductsPage` no toca estado — solo pide y devuelve. El efecto de
  // abajo aplica el resultado en `.then()/.catch()`, mismo patrón que
  // `silent-refresh-gate.tsx`: la regla react-hooks/set-state-in-effect
  // rastrea CUALQUIER función invocada desde el cuerpo del efecto que llegue
  // a llamar un setState, así que ese `setState` tiene que vivir en el
  // callback de la promesa, nunca dentro de una función que el efecto llama
  // directamente.
  const fetchProductsPage = useCallback(() => {
    return apiRequest<AdminProduct[], PaginationMeta>("/api/v1/admin/products", {
      authenticated: true,
      query: {
        page,
        limit: PAGE_LIMIT,
        search: debouncedSearch || undefined,
        categoryId: categoryId ?? undefined,
        status: status ?? undefined,
        channel: channel ?? undefined,
      },
    });
  }, [page, debouncedSearch, categoryId, status, channel]);

  useEffect(() => {
    let cancelled = false;
    fetchProductsPage()
      .then((response) => {
        if (cancelled) return;
        setProducts(response.data);
        setMeta(response.meta ?? null);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(
          error instanceof ApiRequestError ? error.message : "No pudimos cargar los productos.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [fetchProductsPage, retryKey]);

  function handleCategoryChange(value: string) {
    setCategoryId(value);
    setPage(1);
  }

  function handleStatusChange(value: string) {
    setStatus(value);
    setPage(1);
  }

  function handleChannelChange(value: string) {
    setChannel(value);
    setPage(1);
  }

  async function handleTogglePublish(product: AdminProduct, nextActive: boolean) {
    setTogglingId(product.id);
    try {
      const response = await apiRequest<AdminProduct>(`/api/v1/admin/products/${product.id}`, {
        method: "PATCH",
        authenticated: true,
        body: { status: nextActive ? "active" : "draft" },
      });
      setProducts((current) =>
        current?.map((p) => (p.id === product.id ? response.data : p)) ?? current,
      );
      toast({
        variant: "success",
        title: nextActive ? "Producto publicado" : "Producto despublicado",
        description: product.name,
      });
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo cambiar el estado",
        description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setTogglingId(null);
    }
  }

  async function handleConfirmArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await apiRequest(`/api/v1/admin/products/${archiveTarget.id}`, {
        method: "DELETE",
        authenticated: true,
      });
      setProducts((current) => current?.filter((p) => p.id !== archiveTarget.id) ?? current);
      toast({ variant: "success", title: "Producto archivado", description: archiveTarget.name });
      setArchiveTarget(null);
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo archivar el producto",
        description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setArchiving(false);
    }
  }

  const isFiltered = Boolean(debouncedSearch || categoryId || status || channel);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-body text-muted-foreground-strong">Gestiona el catálogo de la tienda.</p>
        <Link href="/products/new" className={getButtonClassName("primary", "md")}>
          <Plus size={16} weight="bold" aria-hidden="true" />
          Nuevo producto
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input
            label="Buscar"
            placeholder="Busca por nombre o SKU"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Select
            label="Categoría"
            value={categoryId}
            onChange={handleCategoryChange}
            options={categoryOptions}
            placeholder="Todas"
          />
        </div>
        <div className="w-40">
          <Select label="Estado" value={status} onChange={handleStatusChange} options={STATUS_OPTIONS} placeholder="Todos" />
        </div>
        <div className="w-40">
          <Select
            label="Canal"
            value={channel}
            onChange={handleChannelChange}
            options={CHANNEL_OPTIONS}
            placeholder="Todos"
          />
        </div>
      </div>

      {loadError ? (
        <ErrorState description={loadError} onRetry={() => setRetryKey((k) => k + 1)} />
      ) : products === null ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-border bg-surface">
              <Skeleton className="aspect-square rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-5 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={Tag}
          title={isFiltered ? "Ningún producto coincide con estos filtros" : "Todavía no hay productos"}
          description={
            isFiltered
              ? "Ajusta la búsqueda o quita algún filtro."
              : "Crea el primero para empezar a armar el catálogo."
          }
          action={
            !isFiltered ? (
              <Link href="/products/new" className={getButtonClassName("secondary", "sm")}>
                Nuevo producto
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                category={categoriesById.get(product.categoryId)}
                badge={product.badgeId ? badgesById.get(product.badgeId) : undefined}
                onTogglePublish={handleTogglePublish}
                onArchive={setArchiveTarget}
                togglingPublish={togglingId === product.id}
              />
            ))}
          </div>
          {meta ? <Pagination meta={meta} onPageChange={setPage} /> : null}
        </>
      )}

      <ArchiveProductModal
        product={archiveTarget}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={handleConfirmArchive}
        loading={archiving}
      />
    </div>
  );
}
