"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Gift, Plus } from "@phosphor-icons/react";
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
import { BundleRow } from "@/components/bundles/bundle-row";
import { ArchiveBundleModal } from "@/components/bundles/archive-bundle-modal";
import { useCatalogFilters } from "@/lib/hooks/use-catalog-filters";
import type { AdminBundle, AdminBundleStatus, AdminProduct } from "@/lib/types/admin-catalog";

const STATUS_OPTIONS = [
  { value: "draft", label: "Borrador" },
  { value: "active", label: "Publicado" },
  { value: "archived", label: "Archivado" },
];

const PAGE_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 300;

function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex items-center gap-4 rounded-lg border border-border-strong bg-surface p-4">
          <Skeleton className="h-16 w-16 shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

/**
 * Milestone 2.2.3, Fase 3 — listado real de paquetes, Propuesta C elegida
 * por Manuel (filas anchas, composición completa sin truncar). El título de
 * página ya lo pone `TopBar`; esta pantalla no lo repite.
 */
export default function BundlesPage() {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<AdminBundleStatus | null>(null);
  const [page, setPage] = useState(1);

  const [bundles, setBundles] = useState<AdminBundle[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [productsById, setProductsById] = useState<Map<string, AdminProduct>>(new Map());

  const { badgesById } = useCatalogFilters();

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AdminBundle | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  const fetchBundlesPage = useCallback(() => {
    return apiRequest<AdminBundle[], PaginationMeta>("/api/v1/admin/bundles", {
      authenticated: true,
      query: { page, limit: PAGE_LIMIT, search: debouncedSearch || undefined, status: status ?? undefined },
    });
  }, [page, debouncedSearch, status]);

  useEffect(() => {
    let cancelled = false;
    fetchBundlesPage()
      .then((response) => {
        if (cancelled) return;
        setBundles(response.data);
        setMeta(response.meta ?? null);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar los paquetes.");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchBundlesPage, retryKey]);

  // Resuelve nombre/variante de cada componente de ESTA página — `items`
  // viaja sin enriquecer (bundle-dto.ts). Deduplicado por producto único, no
  // por línea: varios paquetes suelen compartir el mismo componente.
  useEffect(() => {
    if (!bundles || bundles.length === 0) return;
    const uniqueProductIds = [...new Set(bundles.flatMap((b) => b.items.map((i) => i.productId)))].filter(
      (id) => !productsById.has(id),
    );
    if (uniqueProductIds.length === 0) return;

    let cancelled = false;
    Promise.all(
      uniqueProductIds.map((id) =>
        apiRequest<AdminProduct>(`/api/v1/admin/products/${id}`, { authenticated: true })
          .then((res) => res.data)
          .catch(() => null),
      ),
    ).then((products) => {
      if (cancelled) return;
      setProductsById((current) => {
        const next = new Map(current);
        for (const product of products) if (product) next.set(product.id, product);
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `productsById` se lee para deduplicar, no debe reprogramar el efecto
  }, [bundles]);

  function handleStatusChange(value: string) {
    setStatus(value === "" ? null : (value as AdminBundleStatus));
    setPage(1);
  }

  async function handleTogglePublish(bundle: AdminBundle, nextActive: boolean) {
    setTogglingId(bundle.id);
    try {
      const response = await apiRequest<AdminBundle>(`/api/v1/admin/bundles/${bundle.id}`, {
        method: "PATCH",
        authenticated: true,
        body: { status: nextActive ? "active" : "draft" },
      });
      setBundles((current) => current?.map((b) => (b.id === bundle.id ? response.data : b)) ?? current);
      toast({
        variant: "success",
        title: nextActive ? "Paquete publicado" : "Paquete despublicado",
        description: bundle.name,
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
      await apiRequest(`/api/v1/admin/bundles/${archiveTarget.id}`, { method: "DELETE", authenticated: true });
      setBundles((current) => current?.filter((b) => b.id !== archiveTarget.id) ?? current);
      toast({ variant: "success", title: "Paquete archivado", description: archiveTarget.name });
      setArchiveTarget(null);
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo archivar el paquete",
        description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setArchiving(false);
    }
  }

  const isFiltered = Boolean(debouncedSearch || status);

  const emptyMessage = useMemo(
    () => ({
      title: isFiltered ? "Ningún paquete coincide con estos filtros" : "Todavía no hay paquetes",
      description: isFiltered
        ? "Ajusta la búsqueda o quita algún filtro."
        : "Arma tu primer paquete combinando productos ya existentes del catálogo.",
    }),
    [isFiltered],
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:max-w-xl">
          <Input
            label="Buscar"
            placeholder="Ritual Nocturno Completo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Select
            label="Estado"
            value={status ?? ""}
            onChange={handleStatusChange}
            options={[{ value: "", label: "Todos" }, ...STATUS_OPTIONS]}
            className="sm:w-52"
          />
        </div>
        <Link href="/bundles/new" className={getButtonClassName("primary", "md")}>
          <Plus size={16} weight="bold" aria-hidden="true" />
          Nuevo paquete
        </Link>
      </div>

      {loadError ? (
        <ErrorState description={loadError} onRetry={() => setRetryKey((k) => k + 1)} />
      ) : bundles === null ? (
        <RowsSkeleton />
      ) : bundles.length === 0 ? (
        <EmptyState
          icon={Gift}
          title={emptyMessage.title}
          description={emptyMessage.description}
          action={
            !isFiltered ? (
              <Link href="/bundles/new" className={getButtonClassName("secondary", "sm")}>
                Nuevo paquete
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {bundles.map((bundle) => (
              <BundleRow
                key={bundle.id}
                bundle={bundle}
                badge={bundle.badgeId ? badgesById.get(bundle.badgeId) : undefined}
                productsById={productsById}
                onTogglePublish={(next) => handleTogglePublish(bundle, next)}
                onArchive={() => setArchiveTarget(bundle)}
                togglingPublish={togglingId === bundle.id}
              />
            ))}
          </div>
          {meta ? (
            <Pagination meta={meta} onPageChange={setPage} itemLabel={{ singular: "paquete", plural: "paquetes" }} />
          ) : null}
        </>
      )}

      <ArchiveBundleModal
        bundle={archiveTarget}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={handleConfirmArchive}
        loading={archiving}
      />
    </div>
  );
}
