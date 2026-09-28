import { useCallback, useEffect, useState } from "react";
import { apiRequest, ApiRequestError } from "@/lib/api";
import type { AdminCategory } from "@/lib/types/admin-catalog";

/** Mismo tope que la pantalla de Categorías: la jerarquía completa cabe en
 * una sola página (cientos de productos, decenas de categorías). */
const CATEGORY_LIST_LIMIT = 100;

interface CategoryGroup {
  root: AdminCategory;
  children: AdminCategory[];
}

/**
 * Categorías raíz con sus subcategorías, en el orden que Manuel fijó en la
 * pantalla de Categorías (`sortOrder`). El inventario agrupa por raíz
 * (decisión del Milestone 2.5); las subcategorías solo dan el nombre
 * secundario de cada fila. Incluye inactivas: una categoría oculta en la
 * tienda sigue teniendo stock que contar.
 */
function useCategoryTree() {
  const [groups, setGroups] = useState<CategoryGroup[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const fetchCategories = useCallback(() => {
    return apiRequest<AdminCategory[]>("/api/v1/admin/categories", {
      authenticated: true,
      query: { limit: CATEGORY_LIST_LIMIT, sort: "sortOrder" },
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCategories()
      .then((response) => {
        if (cancelled) return;
        const roots = response.data.filter((category) => category.parentId === null);
        setGroups(
          roots.map((root) => ({
            root,
            children: response.data.filter((category) => category.parentId === root.id),
          })),
        );
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar las categorías.");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchCategories, retryKey]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  return { groups, loadError, retry };
}

export { useCategoryTree };
export type { CategoryGroup };
