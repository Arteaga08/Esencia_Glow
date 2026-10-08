"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { AdminBadge, AdminBrand, AdminCategory } from "@/lib/types/admin-catalog";

interface CategoryOption {
  value: string;
  label: string;
}

/**
 * Categorías, marcas y badges: los usan tanto el listado (filtros) como el editor
 * (selects del formulario) — un solo fetch, un solo lugar que decide cómo
 * se indentan las subcategorías. Si falla, el resto de la pantalla sigue
 * funcionando sin nombres — nunca vale la pena tirarla por esto.
 */
function useCatalogFilters() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [badges, setBadges] = useState<AdminBadge[]>([]);
  const [brands, setBrands] = useState<AdminBrand[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiRequest<AdminCategory[]>("/api/v1/admin/categories", {
        authenticated: true,
        query: { limit: 100 },
      }),
      apiRequest<AdminBadge[]>("/api/v1/admin/badges", {
        authenticated: true,
        query: { limit: 100 },
      }),
      apiRequest<AdminBrand[]>("/api/v1/admin/brands", {
        authenticated: true,
        query: { limit: 100 },
      }),
    ])
      .then(([categoriesRes, badgesRes, brandsRes]) => {
        if (cancelled) return;
        setCategories(categoriesRes.data);
        setBadges(badgesRes.data);
        setBrands(brandsRes.data);
      })
      .catch(() => {
        // Silencioso a propósito — ver comentario de arriba.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryOptions = useMemo<CategoryOption[]>(() => {
    const roots = categories.filter((c) => c.parentId === null);
    const byParent = new Map<string, AdminCategory[]>();
    for (const c of categories) {
      if (!c.parentId) continue;
      byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c]);
    }
    return roots.flatMap((root) => [
      { value: root.id, label: root.name },
      ...(byParent.get(root.id) ?? []).map((child) => ({ value: child.id, label: `— ${child.name}` })),
    ]);
  }, [categories]);

  const badgeOptions = useMemo<CategoryOption[]>(
    () => badges.map((b) => ({ value: b.id, label: b.text })),
    [badges],
  );

  const brandOptions = useMemo<CategoryOption[]>(
    () => brands.map((b) => ({ value: b.id, label: b.name })),
    [brands],
  );

  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const badgesById = useMemo(() => new Map(badges.map((b) => [b.id, b])), [badges]);
  const brandsById = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);

  return { categories, badges, brands, categoryOptions, badgeOptions, brandOptions, categoriesById, badgesById, brandsById };
}

export { useCatalogFilters };
