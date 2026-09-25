"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { FolderSimple, Plus } from "@phosphor-icons/react";
import { apiRequest, ApiRequestError } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { RootCategoryRow } from "@/components/categories/root-category-row";
import { CategoryFormModal, type CategoryFormTarget } from "@/components/categories/category-form-modal";
import { DeleteCategoryModal } from "@/components/categories/delete-category-modal";
import type { AdminCategory } from "@/lib/types/admin-catalog";

// El árbol de categorías de una tienda no crece a paginación real — mismo
// criterio que useCatalogFilters.ts (limit alto, filtro por parentId en el
// cliente). Si algún día se acerca a este tope, es un problema de escala
// para revisar aparte, no algo que esta sección deba resolver hoy.
const LIST_LIMIT = 100;

export default function CategoriesPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [formTarget, setFormTarget] = useState<CategoryFormTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = useCallback(() => {
    return apiRequest<AdminCategory[]>("/api/v1/admin/categories", {
      authenticated: true,
      query: { limit: LIST_LIMIT },
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCategories()
      .then((response) => {
        if (cancelled) return;
        setCategories(response.data);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(
          error instanceof ApiRequestError ? error.message : "No pudimos cargar las categorías.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [fetchCategories, retryKey]);

  const roots = (categories ?? [])
    .filter((c) => c.parentId === null)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = roots.map((c) => c.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const reordered = arrayMove(ids, from, to);

    // Optimista: se ve reordenado ya, se revierte si la API rechaza.
    const previous = categories;
    setCategories((current) =>
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
        body: { parentId: null, ids: reordered },
      });
    } catch (error) {
      setCategories(previous);
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
      setCategories((current) => current?.map((c) => (c.id === category.id ? response.data : c)) ?? current);
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
    setCategories((current) => {
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
      setCategories((current) => current?.filter((c) => c.id !== deleteTarget.id) ?? current);
      toast({ variant: "success", title: "Categoría borrada", description: deleteTarget.name });
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-body text-muted-foreground-strong">
          Organiza el catálogo por categorías y subcategorías.
        </p>
        <Button onClick={() => setFormTarget({ mode: "create", parentId: null })}>
          <Plus size={16} weight="bold" aria-hidden="true" />
          Nueva categoría
        </Button>
      </div>

      {loadError ? (
        <ErrorState description={loadError} onRetry={() => setRetryKey((k) => k + 1)} />
      ) : categories === null ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] w-full" />
          ))}
        </div>
      ) : roots.length === 0 ? (
        <EmptyState
          icon={FolderSimple}
          title="Todavía no hay categorías"
          description="Crea la primera para empezar a organizar el catálogo."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFormTarget({ mode: "create", parentId: null })}
            >
              Nueva categoría
            </Button>
          }
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={roots.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {roots.map((category) => (
                <RootCategoryRow
                  key={category.id}
                  category={category}
                  onEnter={() => router.push(`/categories/${category.id}`)}
                  onEdit={() => setFormTarget({ mode: "edit", category })}
                  onDelete={() => setDeleteTarget(category)}
                  onToggleVisible={(next) => handleToggleVisible(category, next)}
                  togglingVisible={togglingId === category.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <CategoryFormModal target={formTarget} onClose={() => setFormTarget(null)} onSaved={handleSaved} />
      <DeleteCategoryModal
        category={deleteTarget}
        isSubcategory={false}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </div>
  );
}
