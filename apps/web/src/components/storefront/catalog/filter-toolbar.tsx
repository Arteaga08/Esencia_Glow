"use client";

import { CaretDown } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PublicProductFacets } from "@esencia-glow/shared";
import { SORT_OPTIONS } from "@/lib/storefront/catalog-filters";
import { formatMoneyMXN } from "@/lib/format-money";
import { BrandField, PriceField, SortField } from "./filter-fields";
import type { CatalogFilterState } from "./use-catalog-navigation";

type PanelId = "brand" | "price" | "sort";

interface FilterToolbarProps {
  state: CatalogFilterState;
  facets: PublicProductFacets;
  /** Productos que coinciden con los filtros, en todas las páginas. */
  total: number;
}

interface Panel {
  id: PanelId;
  label: string;
  /** Lo aplicado, en corto; vacío si el filtro está sin usar. */
  value: string;
  content: ReactNode;
  onClear?: () => void;
  /** El panel de orden se ancla a la derecha para no salirse de la pantalla. */
  alignEnd?: boolean;
}

const TRIGGER =
  "inline-flex min-h-11 items-center gap-2 rounded-md border px-4 transition-colors duration-[var(--duration-base)] ease-out-quart " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function summarizeBrands(brands: string[]): string {
  if (brands.length === 0) return "";
  return brands.length === 1 ? brands[0]! : `${brands[0]} +${brands.length - 1}`;
}

function summarizePrice(min: string, max: string): string {
  const from = min ? formatMoneyMXN(Number(min) * 100) : "";
  const to = max ? formatMoneyMXN(Number(max) * 100) : "";
  if (from && to) return `${from.replace(".00", "")} a ${to.replace(".00", "")}`;
  if (from) return `Desde ${from.replace(".00", "")}`;
  if (to) return `Hasta ${to.replace(".00", "")}`;
  return "";
}

/**
 * Barra de filtros: Marca y Precio a la izquierda, Orden a la derecha junto al
 * conteo (ordenar no es filtrar). Cada botón muestra lo aplicado (Marca: Bora
 * +1) para no obligar a abrirlo, y el panel trae su propio "Quitar". Solo uno
 * abierto a la vez; cierra con Escape o al tocar fuera.
 */
function FilterToolbar({ state, facets, total }: FilterToolbarProps) {
  const [openId, setOpenId] = useState<PanelId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openId) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openId]);

  const sortLabel = SORT_OPTIONS.find((option) => option.value === state.filters.sort)?.label ?? "";
  // Sin marcas o sin rango de precio (categoría vacía o API caído) ese filtro no tiene qué ofrecer.
  const hasPriceRange = facets.minPrice !== null && facets.maxPrice !== null && facets.minPrice < facets.maxPrice;

  const filterPanels: Panel[] = [];
  if (facets.brands.length > 0) {
    filterPanels.push({
      id: "brand",
      label: "Marca",
      value: summarizeBrands(state.filters.brands),
      content: <BrandField state={state} brands={facets.brands} />,
      onClear: state.filters.brands.length > 0 ? () => state.setBrands([]) : undefined,
    });
  }
  if (hasPriceRange) {
    filterPanels.push({
      id: "price",
      label: "Precio",
      value: summarizePrice(state.filters.min, state.filters.max),
      content: <PriceField state={state} minPrice={facets.minPrice} maxPrice={facets.maxPrice} />,
      onClear: state.filters.min || state.filters.max ? () => state.setPriceRange("", "") : undefined,
    });
  }
  const sortPanel: Panel = {
    id: "sort",
    label: "Ordenar",
    value: sortLabel,
    content: <SortField state={state} />,
    alignEnd: true,
  };

  function renderPanel(panel: Panel) {
    const isOpen = openId === panel.id;
    const isApplied = panel.value !== "" && panel.id !== "sort";
    return (
      <div key={panel.id} className="md:relative">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={`catalog-panel-${panel.id}`}
          onClick={() => setOpenId(isOpen ? null : panel.id)}
          className={`${TRIGGER} ${isApplied ? "border-foreground bg-blush" : isOpen ? "border-foreground bg-surface" : "border-primary-action bg-surface hover:border-foreground"}`}
        >
          <span className="type-shop-cta text-foreground">{panel.label}</span>
          {panel.value ? <span className="max-w-[10rem] truncate text-body-sm text-foreground">{panel.value}</span> : null}
          <CaretDown
            size={14}
            aria-hidden="true"
            className={`shrink-0 transition-transform duration-[var(--duration-base)] ease-out-quart motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
        <div
          id={`catalog-panel-${panel.id}`}
          hidden={!isOpen}
          className={`absolute inset-x-0 top-full z-40 mt-2 rounded-md border border-border-strong bg-surface md:inset-x-auto md:w-80 ${panel.alignEnd ? "md:right-0" : "md:left-0"}`}
        >
          <div className="max-h-[min(24rem,60dvh)] overflow-y-auto p-4">{panel.content}</div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
            {panel.onClear ? (
              <button
                type="button"
                onClick={panel.onClear}
                className="type-shop-cta text-foreground underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Quitar
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="type-shop-cta rounded-md px-3 py-2 text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex flex-wrap items-center gap-2">{filterPanels.map(renderPanel)}</div>
      <div className="flex items-center gap-4">
        <p className="hidden text-body-sm text-muted-foreground-strong sm:block" aria-live="polite">
          {total} {total === 1 ? "producto" : "productos"}
        </p>
        {renderPanel(sortPanel)}
      </div>
    </div>
  );
}

export { FilterToolbar };
