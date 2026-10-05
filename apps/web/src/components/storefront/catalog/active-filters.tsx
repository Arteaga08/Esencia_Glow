"use client";

import { X } from "@phosphor-icons/react";
import { formatMoneyMXN } from "@/lib/format-money";
import type { CatalogFilterState } from "./use-catalog-navigation";

/** Descripción corta del rango de precio activo, o `null` si no hay. */
function describePriceRange(min: string, max: string): string | null {
  const from = min ? formatMoneyMXN(Number(min) * 100).replace(".00", "") : null;
  const to = max ? formatMoneyMXN(Number(max) * 100).replace(".00", "") : null;
  if (from && to) return `${from} a ${to}`;
  if (from) return `Desde ${from}`;
  if (to) return `Hasta ${to}`;
  return null;
}

const CHIP =
  "inline-flex min-h-9 items-center gap-2 rounded-md border border-primary-action bg-surface px-3 text-body-sm text-foreground " +
  "hover:bg-blush/70 transition-colors duration-[var(--duration-base)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Chips de los filtros activos: un clic quita cada uno. No pinta nada si no hay. */
function ActiveFilters({ state }: { state: CatalogFilterState }) {
  const price = describePriceRange(state.filters.min, state.filters.max);
  if (state.filters.brands.length === 0 && !price) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Filtros activos">
      {state.filters.brands.map((brand) => (
        <li key={brand}>
          <button type="button" onClick={() => state.toggleBrand(brand)} className={CHIP} aria-label={`Quitar filtro ${brand}`}>
            {brand}
            <X size={14} aria-hidden="true" />
          </button>
        </li>
      ))}
      {price ? (
        <li>
          <button
            type="button"
            onClick={() => state.setPriceRange("", "")}
            className={CHIP}
            aria-label={`Quitar filtro de precio ${price}`}
          >
            {price}
            <X size={14} aria-hidden="true" />
          </button>
        </li>
      ) : null}
      <li>
        <button
          type="button"
          onClick={state.clearFilters}
          className="px-2 type-shop-cta text-foreground underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Quitar todo
        </button>
      </li>
    </ul>
  );
}

export { ActiveFilters };
