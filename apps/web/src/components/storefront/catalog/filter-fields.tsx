"use client";

import { Check } from "@phosphor-icons/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SORT_OPTIONS, buildPricePresets } from "@/lib/storefront/catalog-filters";
import type { CatalogFilterState } from "./use-catalog-navigation";

const FOCUS_RING = "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring";
// Tiempo de espera tras teclear antes de pedir los productos: evita una petición por dígito.
const PRICE_DEBOUNCE_MS = 600;

function Legend({ children }: { children: string }) {
  return <legend className="sr-only">{children}</legend>;
}

/** Marcas con casilla propia (cuadro que se llena de rosa oscuro). */
function BrandField({ state, brands }: { state: CatalogFilterState; brands: string[] }) {
  return (
    <fieldset>
      <Legend>Marca</Legend>
      <ul className="flex flex-col">
        {brands.map((brand) => (
          <li key={brand}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted">
              <input
                type="checkbox"
                checked={state.filters.brands.includes(brand)}
                onChange={() => state.toggleBrand(brand)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className={`flex size-5 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-surface text-primary-foreground transition-colors duration-[var(--duration-fast)] peer-checked:border-primary-action peer-checked:bg-primary-action peer-checked:[&>svg]:opacity-100 ${FOCUS_RING}`}
              >
                <Check size={14} weight="bold" className="opacity-0" />
              </span>
              <span className="flex-1 text-body text-foreground">{brand}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

const PRICE_INPUT =
  "w-full rounded-md border border-border-strong bg-input py-2.5 pl-7 pr-3 text-body text-foreground " +
  "placeholder:text-muted-foreground-strong hover:border-foreground " +
  "focus-visible:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const PRESET_CHIP =
  "min-h-9 rounded-md border px-3 text-body-sm text-foreground transition-colors duration-[var(--duration-fast)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

interface PriceInputProps {
  label: string;
  placeholder: string;
  value: string;
  onCommit: (value: string) => void;
}

/**
 * Campo de pesos con borrador local: lo que se teclea se aplica tras una
 * pausa (o al salir del campo), no en cada dígito. Si el filtro cambia desde
 * fuera (un atajo, "Quitar"), el borrador se alinea con el valor nuevo.
 */
function PriceInput({ label, placeholder, value, onCommit }: PriceInputProps) {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Alinea el borrador con el filtro cuando éste cambia desde fuera (atajo,
  // "Quitar", botón atrás); ajustar el estado al renderizar evita un render extra.
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(value);
  }
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const commit = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (next !== value) onCommit(next);
  };

  return (
    <label className="flex flex-col gap-1.5 text-body-sm text-muted-foreground-strong">
      {label}
      <span className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-foreground">
          $
        </span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={draft}
          placeholder={placeholder}
          onChange={(event) => {
            const next = event.target.value.replace(/[^\d.]/g, "").slice(0, 9);
            setDraft(next);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => commit(next), PRICE_DEBOUNCE_MS);
          }}
          onBlur={() => commit(draft)}
          onKeyDown={(event) => event.key === "Enter" && commit(draft)}
          className={PRICE_INPUT}
        />
      </span>
    </label>
  );
}

interface PriceFieldProps {
  state: CatalogFilterState;
  minPrice: number | null;
  maxPrice: number | null;
}

/** Precio: atajos calculados con el rango de la categoría y, debajo, mínimo y máximo exactos. */
function PriceField({ state, minPrice, maxPrice }: PriceFieldProps) {
  const presets = useMemo(() => buildPricePresets(minPrice, maxPrice), [minPrice, maxPrice]);
  const { min, max } = state.filters;

  return (
    <fieldset>
      <Legend>Precio</Legend>
      {presets.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {presets.map((preset) => {
            const active = preset.min === min && preset.max === max;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => (active ? state.setPriceRange("", "") : state.setPriceRange(preset.min, preset.max))}
                className={`${PRESET_CHIP} ${active ? "border-foreground bg-blush" : "border-border-strong bg-surface hover:border-foreground"}`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <PriceInput label="Desde" placeholder="Ej. 250" value={min} onCommit={(next) => state.setPriceRange(next, max)} />
        <PriceInput label="Hasta" placeholder="Ej. 400" value={max} onCommit={(next) => state.setPriceRange(min, next)} />
      </div>
    </fieldset>
  );
}

/** Orden: filas excluyentes; la elegida lleva fondo rosa y una paloma. */
function SortField({ state }: { state: CatalogFilterState }) {
  const groupName = useId();
  return (
    <fieldset>
      <Legend>Ordenar por</Legend>
      <ul className="flex flex-col">
        {SORT_OPTIONS.map((option) => (
          <li key={option.value}>
            <label className="relative block cursor-pointer">
              <input
                type="radio"
                name={groupName}
                checked={state.filters.sort === option.value}
                onChange={() => state.setSort(option.value)}
                className="peer sr-only"
              />
              <span
                className={`flex min-h-11 items-center justify-between gap-3 rounded-md px-3 text-body text-foreground hover:bg-muted peer-checked:bg-blush peer-checked:[&_svg]:opacity-100 ${FOCUS_RING}`}
              >
                {option.label}
                <Check size={16} weight="bold" aria-hidden="true" className="opacity-0" />
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

export { BrandField, PriceField, SortField };
