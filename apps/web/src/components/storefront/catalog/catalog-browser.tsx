"use client";

import type { PaginationMeta, PublicProductFacets } from "@esencia-glow/shared";
import type { CatalogFilters } from "@/lib/storefront/catalog-filters";
import type { ShelfItem } from "@/lib/storefront/shelf-item";
import { ActiveFilters } from "./active-filters";
import { CatalogGrid } from "./catalog-grid";
import { CatalogPagination } from "./catalog-pagination";
import { FilterToolbar } from "./filter-toolbar";
import { useCatalogNavigation } from "./use-catalog-navigation";

interface CatalogBrowserProps {
  pathname: string;
  filters: CatalogFilters;
  facets: PublicProductFacets;
  items: ShelfItem[];
  meta: PaginationMeta;
}

/**
 * Barra de filtros pegajosa, chips de lo aplicado, rejilla y paginación. Los
 * productos ya vienen filtrados del servidor; mientras llega la respuesta de
 * un cambio de filtro la rejilla se atenúa para que se note que está cargando.
 */
function CatalogBrowser({ pathname, filters: committed, facets, items, meta }: CatalogBrowserProps) {
  const state = useCatalogNavigation(committed, pathname);

  return (
    <>
      <div className="sticky top-16 z-30 mt-6 border-y border-border bg-background xl:top-20">
        <div className="mx-auto max-w-shell px-4 py-3 md:px-8 xl:px-12">
          <FilterToolbar state={state} facets={facets} total={meta.total} />
        </div>
      </div>

      <section className="mx-auto max-w-shell px-4 pb-20 pt-6 md:px-8 md:pb-28 xl:px-12" aria-label="Productos" aria-busy={state.isPending}>
        <div className={state.activeCount > 0 ? "mb-8" : ""}>
          <ActiveFilters state={state} />
        </div>
        <div className={`transition-opacity duration-[var(--duration-base)] ease-out-quart motion-reduce:transition-none ${state.isPending ? "opacity-50" : "opacity-100"} ${state.activeCount > 0 ? "" : "pt-4"}`}>
          <CatalogGrid items={items} hasFilters={state.activeCount > 0} onClear={state.clearFilters} />
          <CatalogPagination meta={meta} filters={committed} pathname={pathname} />
        </div>
      </section>
    </>
  );
}

export { CatalogBrowser };
