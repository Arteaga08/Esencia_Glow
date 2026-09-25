"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ArrowLeft, FolderSimple, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Table, type TableColumn } from "@/components/ui/table";
import { SubcategoryRow } from "@/components/categories/subcategory-row";
import { CategoryFormModal, type CategoryFormTarget } from "@/components/categories/category-form-modal";
import { DeleteCategoryModal } from "@/components/categories/delete-category-modal";
import type { AdminCategory } from "@/lib/types/admin-catalog";

const LIST_LIMIT = 100; // Ver nota en categories/page.tsx.

export default function SubcategoriesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const parentId = params.id;

  const [parent, setParent] = useState<AdminCategory | null>(null);
  const [children, setChildren] = useState<AdminCategory[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<CategoryFormTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(() => {
    return Promise.all([
      apiRequest<AdminCategory>(`/api/v1/admin/categories/${parentId}`, { authenticated: true }),
      apiRequest<AdminCategory[]>("/api/v1/admin/categories", {
        authenticated: true,
        query: { parentId, limit: LIST_LIMIT },
      }),
    ]);
  }, [parentId]);

  useEffect(() => {
    let cancelled = false;
    fetchData()
      .then(([parentRes, childrenRes]) => {
        if (cancelled) return;
        setParent(parentRes.data);
        setChildren(childrenRes.data);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(
          error instanceof ApiRequestError ? error.message : "No pudimos cargar la categoría.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [fetchData, retryKey]);

  const subcategories = (children ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = subcategories.map((c) => c.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const reordered = arrayMove(ids, from, to);

    const previous = children;
    setChildren((current) =>
      current
        ? current.map((c) => {
            const index = reordered.indexOf(c.id);
            return index === -1 ? c : { ...c, sortOrder: index };
          })
        : current,
    );
    try {
      await apiRequest("/api/v1/admin/categories/reorder", {
        method: "PATCH",
        authenticated: true,
        body: { parentId, ids: reordered },
      });
    } catch (error) {
      setChildren(previous);
      toast({
        variant: "error",
        title: "No se pudo reordenar",
        description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
      });
    }
  }

  async function handleToggleVisible(category: AdminCategory, nextActive: boolean) {
    setTogglingId(category.id);
    try {
      const response = await apiRequest<AdminCategory>(`/api/v1/admin/categories/${category.id}`, {
        method: "PATCH",
        authenticated: true,
        body: { isActive: nextActive },
      });
      setChildren((current) => current?.map((c) => (c.id === category.id ? response.data : c)) ?? current);
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo cambiar la visibilidad",
        description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setTogglingId(null);
    }
  }

  function handleSaved(category: AdminCategory) {
    setChildren((current) => {
      if (!current) return [category];
      const exists = current.some((c) => c.id === category.id);
      return exists ? current.map((c) => (c.id === category.id ? category : c)) : [...current, category];
    });
    setFormTarget(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/api/v1/admin/categories/${deleteTarget.id}`, {
        method: "DELETE",
        authenticated: true,
      });
      setChildren((current) => current?.filter((c) => c.id !== deleteTarget.id) ?? current);
      toast({ variant: "success", title: "Subcategoría borrada", description: deleteTarget.name });
      setDeleteTarget(null);
    } catch (error) {
      toast({
        variant: "error",
        title: "No se pudo borrar",
        description: error instanceof ApiRequestError ? error.message : "Intenta de nuevo.",
      });
    } finally {
      setDeleting(false);
    }
  }

  const columns: TableColumn<AdminCategory>[] = [
    {
      header: "",
      className: "w-10",
      render: () => null, // la celda real la arma SubcategoryRow (necesita el handle ahí)
    },
    {
      header: "Subcategoría",
      render: (sub) => (
        <div className="flex items-center gap-3">
          {sub.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sub.image.url} alt={sub.image.alt ?? ""} className="h-9 w-9 shrink-0 rounded-md object-cover" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <FolderSimple size={16} aria-hidden="true" />
            </div>
          )}
          <span className="font-medium text-foreground">{sub.name}</span>
        </div>
      ),
    },
    {
      header: "Productos",
      align: "right",
      render: (sub) => sub.productCount ?? 0,
    },
    {
      header: "Visible",
      align: "right",
      render: (sub) => (
        <div className="flex justify-end">
          <Switch
            checked={sub.isActive}
            onChange={(next) => handleToggleVisible(sub, next)}
            label={`Mostrar ${sub.name}`}
            disabled={togglingId === sub.id}
          />
        </div>
      ),
    },
    {
      header: "Acciones",
      align: "right",
      render: (sub) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => setFormTarget({ mode: "edit", category: sub })}
            aria-label={`Editar ${sub.name}`}
            className="rounded-sm p-1.5 text-muted-foreground-strong hover:bg-muted hover:text-foreground"
          >
            <PencilSimple size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(sub)}
            aria-label={`Borrar ${sub.name}`}
            title="Borra la subcategoría (falla si tiene productos)"
            className="rounded-sm p-1.5 text-destructive-action hover:bg-destructive/30"
          >
            <Trash size={15} aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <button
        type="button"
        onClick={() => router.push("/categories")}
        className="mb-4 flex items-center gap-1.5 text-body-sm text-muted-foreground-strong hover:text-foreground"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Categorías
      </button>

      {loadError ? (
        <ErrorState description={loadError} onRetry={() => setRetryKey((k) => k + 1)} />
      ) : parent === null || children === null ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-section-title text-foreground">{parent.name}</h2>
              <p className="text-body-sm text-muted-foreground-strong">
                Subcategorías de {parent.name.toLowerCase()}.
              </p>
            </div>
            <Button onClick={() => setFormTarget({ mode: "create", parentId })}>
              <Plus size={16} weight="bold" aria-hidden="true" />
              Nueva subcategoría
            </Button>
          </div>

          {subcategories.length === 0 ? (
            <EmptyState
              icon={FolderSimple}
              title="Aún no hay subcategorías"
              description="Crea la primera para organizar los productos de esta categoría."
              action={
                <Button variant="secondary" size="sm" onClick={() => setFormTarget({ mode: "create", parentId })}>
                  Nueva subcategoría
                </Button>
              }
            />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={subcategories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <Table
                  columns={columns}
                  rows={subcategories}
                  rowKey={(sub) => sub.id}
                  renderRow={(sub, cells) => <SubcategoryRow id={sub.id} name={sub.name} cells={cells} />}
                />
              </SortableContext>
            </DndContext>
          )}
        </>
      )}

      <CategoryFormModal target={formTarget} onClose={() => setFormTarget(null)} onSaved={handleSaved} />
      <DeleteCategoryModal
        category={deleteTarget}
        isSubcategory
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </div>
  );
}
