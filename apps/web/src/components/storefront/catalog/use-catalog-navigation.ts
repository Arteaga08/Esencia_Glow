"use client";

import { useRouter } from "next/navigation";
import { useCallback, useOptimistic, useTransition } from "react";
import {
  DEFAULT_CATALOG_FILTERS,
  catalogFiltersToQuery,
  countActiveCatalogFilters,
  type CatalogFilters,
  type CatalogSort,
} from "@/lib/storefront/catalog-filters";

/**
 * Filtros del catálogo con la URL como fuente de verdad: cada cambio navega a
 * `?marca=&min=&max=&orden=` y el servidor vuelve a pedir los productos al API
 * (así la paginación y los conteos son los reales, no los de una lista ya
 * descargada). `useOptimistic` pinta el cambio al instante mientras llega la
 * respuesta; al terminar vuelve a mandar la URL, por eso el botón "atrás" del
 * navegador también funciona. Filtrar siempre regresa a la página 1.
 */
function useCatalogNavigation(committed: CatalogFilters, pathname: string) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setOptimisticFilters] = useOptimistic(committed);

  const commit = useCallback(
    (next: CatalogFilters) => {
      startTransition(() => {
        setOptimisticFilters(next);
        const query = catalogFiltersToQuery(next);
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, setOptimisticFilters],
  );

  const toggleBrand = useCallback(
    (brand: string) =>
      commit({
        ...filters,
        brands: filters.brands.includes(brand) ? filters.brands.filter((name) => name !== brand) : [...filters.brands, brand],
      }),
    [commit, filters],
  );
  const setBrands = useCallback((brands: string[]) => commit({ ...filters, brands }), [commit, filters]);
  const setPriceRange = useCallback((min: string, max: string) => commit({ ...filters, min, max }), [commit, filters]);
  const setSort = useCallback((sort: CatalogSort) => commit({ ...filters, sort }), [commit, filters]);
  const clearFilters = useCallback(() => commit({ ...DEFAULT_CATALOG_FILTERS, sort: filters.sort }), [commit, filters.sort]);

  return {
    filters,
    isPending,
    activeCount: countActiveCatalogFilters(filters),
    toggleBrand,
    setBrands,
    setPriceRange,
    setSort,
    clearFilters,
  };
}

type CatalogFilterState = ReturnType<typeof useCatalogNavigation>;

export { useCatalogNavigation };
export type { CatalogFilterState };
