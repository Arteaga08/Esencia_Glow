"use client";

import { useCallback, useEffect, useState } from "react";
import { PencilSimple, Plus, SealCheck, Trash } from "@phosphor-icons/react";
import type { PaginationMeta } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Badge, BADGE_COLOR_LABELS, BADGE_COLOR_VALUES, type BadgeColorValue } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, type TableColumn } from "@/components/ui/table";
import { BadgeFormModal, type BadgeFormValues } from "@/components/badges/badge-form-modal";
import { DeleteBadgeModal } from "@/components/badges/delete-badge-modal";
import type { AdminBadge } from "@/lib/types/admin-catalog";

const COLOR_OPTIONS = BADGE_COLOR_VALUES.map((value) => ({ value, label: BADGE_COLOR_LABELS[value] }));

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;

type FormModalState = { mode: "create" } | { mode: "edit"; badge: AdminBadge };

/**
 * Milestone 2.2 — sección Badges: entidad puramente decorativa (texto +
 * color de la paleta fija), sin imágenes ni jerarquía. Alta/edición vía
 * modal centrado (decisión confirmada con Manuel), no rutas dedicadas como
 * Productos — la entidad es demasiado pequeña para justificarlas.
 */
export default function BadgesPage() {
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [color, setColor] = useState<BadgeColorValue | null>(null);
  const [page, setPage] = useState(1);

  const [badges, setBadges] = useState<AdminBadge[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [formModal, setFormModal] = useState<FormModalState | null>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string>>({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AdminBadge | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Mismo patrón de debounce que Productos: el reset a página 1 vive dentro
  // del propio timeout, no síncrono en el cuerpo del efecto.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  const fetchBadgesPage = useCallback(() => {
    return apiRequest<AdminBadge[], PaginationMeta>("/api/v1/admin/badges", {
      authenticated: true,
      query: {
        page,
        limit: PAGE_LIMIT,
        search: debouncedSearch || undefined,
        color: color ?? undefined,
      },
    });
  }, [page, debouncedSearch, color]);

  useEffect(() => {
    let cancelled = false;
    fetchBadgesPage()
      .then((response) => {
        if (cancelled) return;
        // Una eliminación puede vaciar la última página: vuelve a la 1 en
        // vez de dejar al operador viendo una tabla vacía sin explicación.
        if (response.data.length === 0 && page > 1) {
          setPage(1);
          return;
        }
        setBadges(response.data);
        setMeta(response.meta ?? null);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar los badges.");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchBadgesPage, retryKey, page]);

  function handleColorChange(value: string) {
    setColor((value || null) as BadgeColorValue | null);
    setPage(1);
  }

  async function handleSubmitForm(values: BadgeFormValues) {
    setFormSubmitting(true);
    setFormFieldErrors({});
    const isEdit = formModal !== null && formModal.mode === "edit";
    try {
      const response =
        formModal !== null && formModal.mode === "edit"
          ? await apiRequest<AdminBadge>(`/api/v1/admin/badges/${formModal.badge.id}`, {
              method: "PATCH",
              authenticated: true,
              body: values,
            })
          : await apiRequest<AdminBadge>("/api/v1/admin/badges", {
              method: "POST",
              authenticated: true,
              body: values,
            });
      toast({
        variant: "success",
        title: isEdit ? "Badge actualizado" : "Badge creado",
        description: response.data.text,
      });
      setFormModal(null);
      setRetryKey((k) => k + 1);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) {
        setFormFieldErrors(error.fieldErrors);
      } else {
        toast({
          variant: "error",
          title: isEdit ? "No se pudo actualizar el badge" : "No se pudo crear el badge",
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
      await apiRequest(`/api/v1/admin/badges/${deleteTarget.id}`, {
        method: "DELETE",
        authenticated: true,
      });
      toast({ variant: "success", title: "Badge eliminado", description: deleteTarget.text });
      setDeleteTarget(null);
      setRetryKey((k) => k + 1);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        setDeleteError(
          "Este badge está asignado a uno o más productos. Quítalo de ahí antes de eliminarlo.",
        );
      } else {
        toast({
          variant: "error",
          title: "No se pudo eliminar el badge",
          description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
        });
      }
    } finally {
      setDeleting(false);
    }
  }

  const isFiltered = Boolean(debouncedSearch || color);

  const columns: TableColumn<AdminBadge>[] = [
    {
      header: "Vista previa",
      render: (badge) => (
        <div className="max-w-50">
          <Badge color={badge.color}>{badge.text}</Badge>
        </div>
      ),
    },
    {
      header: "Color",
      render: (badge) => (
        <span className="text-body-sm text-muted-foreground-strong">{BADGE_COLOR_LABELS[badge.color]}</span>
      ),
    },
    {
      header: "Acciones",
      align: "right",
      render: (badge) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => setFormModal({ mode: "edit", badge })}
            aria-label={`Editar ${badge.text}`}
            className="cursor-pointer rounded-sm p-1.5 text-muted-foreground-strong hover:bg-muted hover:text-foreground"
          >
            <PencilSimple size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(badge)}
            aria-label={`Eliminar ${badge.text}`}
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
          Insignias decorativas para resaltar productos en el catálogo.
        </p>
        <Button variant="primary" onClick={() => setFormModal({ mode: "create" })}>
          <Plus size={16} weight="bold" aria-hidden="true" />
          Nuevo badge
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input
            label="Buscar"
            placeholder="Busca por texto"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="w-48">
          <Select
            label="Color"
            value={color}
            onChange={handleColorChange}
            options={COLOR_OPTIONS}
            placeholder="Todos"
          />
        </div>
      </div>

      {loadError ? (
        <ErrorState description={loadError} onRetry={() => setRetryKey((k) => k + 1)} />
      ) : badges === null ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : badges.length === 0 ? (
        <EmptyState
          icon={SealCheck}
          title={isFiltered ? "Ningún badge coincide con estos filtros" : "Todavía no hay badges"}
          description={
            isFiltered
              ? "Ajusta la búsqueda o quita el filtro de color."
              : "Crea el primero para poder asignarlo a un producto."
          }
          action={
            !isFiltered ? (
              <Button variant="secondary" size="sm" onClick={() => setFormModal({ mode: "create" })}>
                Nuevo badge
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Table columns={columns} rows={badges} rowKey={(badge) => badge.id} />
          {meta ? <Pagination meta={meta} onPageChange={setPage} /> : null}
        </>
      )}

      {formModal ? (
        <BadgeFormModal
          key={formModal.mode === "edit" ? formModal.badge.id : "create"}
          open
          mode={formModal.mode}
          initialValues={formModal.mode === "edit" ? formModal.badge : undefined}
          onClose={() => setFormModal(null)}
          onSubmit={handleSubmitForm}
          fieldErrors={formFieldErrors}
          submitting={formSubmitting}
        />
      ) : null}

      <DeleteBadgeModal
        badge={deleteTarget}
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
