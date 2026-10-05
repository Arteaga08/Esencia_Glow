import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { PaginationMeta } from "@esencia-glow/shared";
import { catalogFiltersToQuery, type CatalogFilters } from "@/lib/storefront/catalog-filters";

const PAGE_LINK =
  "inline-flex min-h-11 items-center gap-2 rounded-md border border-primary-action bg-surface px-4 type-shop-cta text-foreground " +
  "transition-colors duration-[var(--duration-base)] hover:border-foreground hover:bg-blush/70 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Anterior / siguiente con "Página X de Y". Son enlaces normales (con los
 * filtros en la URL), así que cada página se puede abrir, compartir y
 * recorrer sin JavaScript. Con una sola página no pinta nada.
 */
function CatalogPagination({ meta, filters, pathname }: { meta: PaginationMeta; filters: CatalogFilters; pathname: string }) {
  if (meta.pages <= 1) return null;

  const hrefFor = (page: number) => {
    const query = catalogFiltersToQuery(filters, page);
    return query ? `${pathname}?${query}` : pathname;
  };

  return (
    <nav aria-label="Paginación" className="mt-14 flex items-center justify-between gap-4 border-t border-border pt-6">
      {meta.page > 1 ? (
        <Link href={hrefFor(meta.page - 1)} rel="prev" className={PAGE_LINK}>
          <CaretLeft size={16} aria-hidden="true" />
          Anterior
        </Link>
      ) : (
        <span />
      )}
      <p className="text-body-sm text-muted-foreground-strong">
        Página {meta.page} de {meta.pages}
      </p>
      {meta.page < meta.pages ? (
        <Link href={hrefFor(meta.page + 1)} rel="next" className={PAGE_LINK}>
          Siguiente
          <CaretRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export { CatalogPagination };
