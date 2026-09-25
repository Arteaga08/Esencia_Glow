"use client";

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { PaginationMeta } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import type { AdminProduct } from "@/lib/types/admin-catalog";

const RESULT_LIMIT = 6;
const SEARCH_DEBOUNCE_MS = 300;

interface ProductPickerProps {
  value: string | null;
  selectedProduct: AdminProduct | null;
  onChange: (product: AdminProduct) => void;
}

/**
 * Feedback de Manuel (Milestone 2.2.3): un `Select` que vuelca el catálogo
 * completo de golpe no sirve para elegir un componente de paquete — el
 * catálogo real tiene muchos más que las 9-13 filas de la maqueta. Este
 * picker filtra por nombre/SKU mientras se escribe y pide al servidor máximo
 * 6 resultados a la vez (`limit: 6`, no un slice en cliente); con más de 6
 * coincidencias reales pide seguir acotando en vez de listarlas todas.
 *
 * `channel: "store"` de entrada: un producto de la caja de suscripción nunca
 * puede ser componente de un paquete (bundle.service.ts, `assertItemsValid`)
 * — mejor no ofrecerlo que dejar que el backend lo rechace con un 400.
 */
function ProductPicker({ value, selectedProduct, onChange }: ProductPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<AdminProduct[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // `setLoading(true)` vive dentro del callback del timeout, no directo en
    // el cuerpo del efecto (react-hooks/set-state-in-effect) — mismo patrón
    // que el debounce de buscador de products/page.tsx.
    const timeout = setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      apiRequest<AdminProduct[], PaginationMeta>("/api/v1/admin/products", {
        authenticated: true,
        query: { search: query || undefined, channel: "store", limit: RESULT_LIMIT },
      })
        .then((response) => {
          if (cancelled) return;
          setResults(response.data);
          setTotal(response.meta?.total ?? response.data.length);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
          setTotal(0);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function pick(product: AdminProduct) {
    onChange(product);
    setQuery("");
    setOpen(false);
  }

  const hiddenCount = Math.max(0, total - (results?.length ?? 0));

  return (
    <div ref={rootRef} className="relative pt-2">
      <input
        type="text"
        value={open ? query : (selectedProduct?.name ?? "")}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Busca por nombre o SKU…"
        className={
          "peer w-full rounded-md border border-border-strong bg-input px-3 py-2.75 text-body text-foreground " +
          "outline-none transition-colors duration-[var(--duration-fast)] ease-out-quart " +
          "placeholder:text-muted-foreground focus:border-primary-action"
        }
      />
      <label
        className="absolute top-2 left-3 -translate-y-1/2 px-1 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong transition-colors duration-[var(--duration-fast)] ease-out-quart peer-focus:text-primary-action"
        style={{ background: "var(--surface-bg, var(--color-background))" }}
      >
        Producto
      </label>
      {open ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-[var(--shadow-overlay)]">
          {loading ? (
            <p className="px-3 py-4 text-body-sm text-muted-foreground">Buscando…</p>
          ) : !results || results.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-4 text-body-sm text-muted-foreground">
              <MagnifyingGlass size={16} aria-hidden="true" />
              Ningún producto coincide con esa búsqueda.
            </p>
          ) : (
            <ul role="listbox">
              {results.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onClick={() => pick(product)}
                    className={
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-body " +
                      (product.id === value ? "bg-primary text-foreground" : "text-foreground hover:bg-muted")
                    }
                  >
                    {product.name}
                    <span className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
                      {product.variants.length} {product.variants.length === 1 ? "variante" : "variantes"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!loading && hiddenCount > 0 ? (
            <p className="border-t border-border px-3 py-2 text-body-sm text-muted-foreground-strong">
              Y {hiddenCount} más — sigue escribiendo para acotar.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { ProductPicker };
