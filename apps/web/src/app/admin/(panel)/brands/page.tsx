"use client";

import { useCallback, useEffect, useState } from "react";
import { PencilSimple, Plus, Storefront, Trash } from "@phosphor-icons/react";
import type { PaginationMeta } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, type TableColumn } from "@/components/ui/table";
import { BrandFormModal, type BrandFormValues } from "@/components/brands/brand-form-modal";
import { DeleteBrandModal } from "@/components/brands/delete-brand-modal";
import type { AdminBrand } from "@/lib/types/admin-catalog";

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;

type FormModalState = { mode: "create" } | { mode: "edit"; brand: AdminBrand };

/**
 * Sección Marcas: catálogo de nombres que se eligen en el editor de
 * producto. Solo nombre (sin imagen); alta/edición por modal, igual que Badges.
 */
export default function BrandsPage() {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [brands, setBrands] = useState<AdminBrand[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [formModal, setFormModal] = useState<FormModalState | null>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string>>({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AdminBrand | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  const fetchBrandsPage = useCallback(() => {
    return apiRequest<AdminBrand[], PaginationMeta>("/api/v1/admin/brands", {
      authenticated: true,
      query: { page, limit: PAGE_LIMIT, search: debouncedSearch || undefined },
    });
  }, [page, debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    fetchBrandsPage()
      .then((response) => {
        if (cancelled) return;
        // Una eliminación puede vaciar la última página: vuelve a la 1.
        if (response.data.length === 0 && page > 1) {
          setPage(1);
          return;
        }
        setBrands(response.data);
        setMeta(response.meta ?? null);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar las marcas.");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchBrandsPage, retryKey, page]);

  async function handleSubmitForm(values: BrandFormValues) {
    setFormSubmitting(true);
    setFormFieldErrors({});
    const isEdit = formModal !== null && formModal.mode === "edit";
    try {
      const response =
        formModal !== null && formModal.mode === "edit"
          ? await apiRequest<AdminBrand>(`/api/v1/admin/brands/${formModal.brand.id}`, {
              method: "PATCH",
              authenticated: true,
              body: values,
            })
          : await apiRequest<AdminBrand>("/api/v1/admin/brands", {
              method: "POST",
              authenticated: true,
              body: values,
            });
      toast({
        variant: "success",
        title: isEdit ? "Marca actualizada" : "Marca creada",
        description: response.data.name,
      });
      setFormModal(null);
      setRetryKey((k) => k + 1);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) {
        setFormFieldErrors(error.fieldErrors);
      } else {
        toast({
          variant: "error",
          title: isEdit ? "No se pudo actualizar la marca" : "No se pudo crear la marca",
          description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
        });
      }
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiRequest(`/api/v1/admin/brands/${deleteTarget.id}`, {
        method: "DELETE",
        authenticated: true,
      });
      toast({ variant: "success", title: "Marca eliminada", description: deleteTarget.name });
      setDeleteTarget(null);
      setRetryKey((k) => k + 1);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        setDeleteError("Esta marca está asignada a uno o más productos. Quítala de ahí antes de eliminarla.");
      } else {
        toast({
          variant: "error",
          title: "No se pudo eliminar la marca",
          description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
        });
      }
    } finally {
      setDeleting(false);
    }
  }

  const isFiltered = Boolean(debouncedSearch);

  const columns: TableColumn<AdminBrand>[] = [
    {
      header: "Nombre",
      render: (brand) => <span className="text-body text-foreground">{brand.name}</span>,
    },
    {
      header: "Acciones",
      align: "right",
      render: (brand) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => setFormModal({ mode: "edit", brand })}
            aria-label={`Editar ${brand.name}`}
            className="cursor-pointer rounded-sm p-1.5 text-muted-foreground-strong hover:bg-muted hover:text-foreground"
          >
            <PencilSimple size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(brand)}
            aria-label={`Eliminar ${brand.name}`}
            className="cursor-pointer rounded-sm p-1.5 text-destructive-action hover:bg-destructive/30"
          >
            <Trash size={16} aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-body text-muted-foreground-strong">
          Marcas que puedes asignar a tus productos en el catálogo.
        </p>
        <Button variant="primary" onClick={() => setFormModal({ mode: "create" })}>
          <Plus size={16} weight="bold" aria-hidden="true" />
          Nueva marca
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input
            label="Buscar"
            placeholder="Busca por nombre"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {loadError ? (
        <ErrorState description={loadError} onRetry={() => setRetryKey((k) => k + 1)} />
      ) : brands === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <EmptyState
          icon={Storefront}
          title={isFiltered ? "Ninguna marca coincide con la búsqueda" : "Todavía no hay marcas"}
          description={
            isFiltered ? "Prueba con otro nombre." : "Crea la primera para poder asignarla a un producto."
          }
          action={
            !isFiltered ? (
              <Button variant="secondary" size="sm" onClick={() => setFormModal({ mode: "create" })}>
                Nueva marca
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Table columns={columns} rows={brands} rowKey={(brand) => brand.id} />
          {meta ? <Pagination meta={meta} onPageChange={setPage} /> : null}
        </>
      )}

      {formModal ? (
        <BrandFormModal
          key={formModal.mode === "edit" ? formModal.brand.id : "create"}
          open
          mode={formModal.mode}
          initialValues={formModal.mode === "edit" ? formModal.brand : undefined}
          onClose={() => setFormModal(null)}
          onSubmit={handleSubmitForm}
          fieldErrors={formFieldErrors}
          submitting={formSubmitting}
        />
      ) : null}

      <DeleteBrandModal
        brand={deleteTarget}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        error={deleteError}
      />
    </div>
  );
}
