"use client";

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { PaginationMeta } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import type { AdminBundle } from "@/lib/types/admin-catalog";

const RESULT_LIMIT = 6;
const SEARCH_DEBOUNCE_MS = 300;

interface BundlePickerProps {
  onChange: (bundle: AdminBundle) => void;
  /** Texto de la etiqueta flotante. */
  label?: string;
  /** Solo paquetes publicados: el home no muestra uno en borrador. */
  onlyActive?: boolean;
}

/**
 * Espejo de `ProductPicker` para paquetes: filtra por nombre mientras se
 * escribe y pide al servidor máximo 6 resultados (`limit`), nunca el catálogo
 * completo. Es un buscador para AGREGAR: al elegir uno se vacía, quien lo usa
 * decide qué hacer con la selección.
 */
function BundlePicker({ onChange, label = "Paquete", onlyActive = false }: BundlePickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<AdminBundle[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // `setLoading(true)` dentro del callback del timeout (react-hooks/set-state-in-effect),
    // mismo patrón que ProductPicker.
    const timeout = setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      apiRequest<AdminBundle[], PaginationMeta>("/api/v1/admin/bundles", {
        authenticated: true,
        query: { search: query || undefined, status: onlyActive ? "active" : undefined, limit: RESULT_LIMIT },
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
  }, [query, open, onlyActive]);

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

  function pick(bundle: AdminBundle) {
    onChange(bundle);
    setQuery("");
    setOpen(false);
  }

  const hiddenCount = Math.max(0, total - (results?.length ?? 0));

  return (
    <div ref={rootRef} className="relative pt-2">
      <input
        type="text"
        value={open ? query : ""}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Busca por nombre: Rutina glow de 3 pasos"
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
        {label}
      </label>
      {open ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-[var(--shadow-overlay)]">
          {loading ? (
            <p className="px-3 py-4 text-body-sm text-muted-foreground">Buscando…</p>
          ) : !results || results.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-4 text-body-sm text-muted-foreground">
              <MagnifyingGlass size={16} aria-hidden="true" />
              Ningún paquete coincide con esa búsqueda.
            </p>
          ) : (
            <ul role="listbox">
              {results.map((bundle) => (
                <li key={bundle.id}>
                  <button
                    type="button"
                    onClick={() => pick(bundle)}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-body text-foreground hover:bg-muted"
                  >
                    {bundle.name}
                    <span className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
                      {bundle.items.length} {bundle.items.length === 1 ? "pieza" : "piezas"}
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

export { BundlePicker };
