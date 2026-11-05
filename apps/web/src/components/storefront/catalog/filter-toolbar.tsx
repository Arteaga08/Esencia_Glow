"use client";

import { SlidersHorizontal } from "@phosphor-icons/react";
import type { PublicProductFacets } from "@esencia-glow/shared";
import { useCallback, useState } from "react";
import { PRODUCT_COPY, type CatalogCopy } from "./catalog-copy";
import { FilterDrawer } from "./filter-drawer";
import type { CatalogFilterState } from "./use-catalog-navigation";

interface FilterToolbarProps {
  state: CatalogFilterState;
  facets: PublicProductFacets;
  /** Productos que coinciden con los filtros, en todas las páginas. */
  total: number;
  copy?: CatalogCopy;
}

/**
 * Barra del catálogo en una sola línea: el conteo a la izquierda y "Filtrar"
 * a la derecha, que abre el panel lateral con Ordenar, Marca y Precio. El
 * botón lleva entre paréntesis cuántos filtros hay aplicados.
 */
function FilterToolbar({ state, facets, total, copy = PRODUCT_COPY }: FilterToolbarProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const countLabel = `${total} ${total === 1 ? copy.countSingular : copy.countPlural}`;

  return (
    <div className="flex items-center justify-between gap-6">
      <p className="text-body-sm text-muted-foreground-strong" aria-live="polite">
        {countLabel}
      </p>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm type-shop-cta text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Filtrar{state.activeCount > 0 ? ` (${state.activeCount})` : ""}
        <SlidersHorizontal size={18} aria-hidden="true" />
      </button>
      <FilterDrawer open={open} onClose={close} state={state} facets={facets} total={total} copy={copy} />
    </div>
  );
}

export { FilterToolbar };
