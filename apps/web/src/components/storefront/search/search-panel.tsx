"use client";

import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";
import { useDebouncedValue } from "@/components/inventory/use-debounced-value";
import { normalizeSearchTerm, SEARCH_MAX_LENGTH, type SearchPayload } from "@/lib/storefront/search-term";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { SkeletonBlock } from "../states/skeleton-block";
import { SearchResultCard } from "./search-result-card";
import { useProductSearch } from "./use-product-search";

const HEADINGS: Record<SearchPayload["kind"], string> = {
  results: "Resultados",
  bestsellers: "Más vendidos",
  newest: "Lo más nuevo",
};

const GRID = "grid gap-5 md:grid-cols-5 md:gap-6";
const NOTE = "text-body text-muted-foreground-strong";
const INITIAL_PLACEHOLDERS = [0, 1, 2, 3, 4];

/**
 * Buscador de la tienda: baja desde arriba, sobre el header. Al abrir muestra
 * cinco productos (más vendidos o, si no hay, lo más nuevo); al escribir dos
 * letras o más busca por nombre, marca o categoría, esperando a que la clienta
 * deje de teclear. Se monta solo mientras está abierto, así cada apertura
 * empieza limpia. Foco atrapado; Escape y el clic fuera los maneja el header.
 */
function SearchPanel({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const [text, setText] = useState("");
  const term = normalizeSearchTerm(useDebouncedValue(text));
  const { payload, loading, failed } = useProductSearch(term);

  useFocusTrap(panelRef, true);

  // Con el buscador abierto la página de atrás no debe desplazarse.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const items = payload?.items ?? [];
  const noMatches = !loading && payload?.kind === "results" && items.length === 0;

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar buscador"
        onClick={onClose}
        className="fixed inset-0 z-[55] cursor-default bg-foreground/25"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Buscar productos"
        className="fixed inset-x-0 top-0 z-[60] flex max-h-dvh flex-col border-b border-border-strong bg-surface shadow-modal"
      >
        <form
          role="search"
          onSubmit={(event) => event.preventDefault()}
          className="shrink-0 border-b border-border transition-colors duration-[var(--duration-fast)] focus-within:border-foreground motion-reduce:transition-none"
        >
          {/* En móvil calca la barra: la X cae donde estaba el botón del menú y
              la lupa se queda en su lugar, así se abre y se cierra del mismo lado. */}
          <div className="mx-auto flex h-16 max-w-shell items-center gap-1 px-4 md:px-8 xl:h-20 xl:gap-3 xl:px-12">
            <span className="flex size-11 shrink-0 items-center justify-center text-muted-foreground-strong xl:size-auto">
              <MagnifyingGlass size={24} aria-hidden="true" />
            </span>
            <label htmlFor={inputId} className="sr-only">
              Buscar por producto, marca o categoría
            </label>
            {/* 16px: con menos, iOS hace zoom a la página al enfocar el campo. */}
            <input
              id={inputId}
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Sérum, Cosrx, limpiadores…"
              autoComplete="off"
              enterKeyHint="search"
              maxLength={SEARCH_MAX_LENGTH}
              className="h-11 min-w-0 flex-1 bg-transparent text-[16px] text-foreground placeholder:text-muted-foreground-strong focus:outline-none"
            />
            <button
              type="button"
              aria-label="Cerrar buscador"
              onClick={onClose}
              className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors max-xl:order-first max-xl:-ml-2.5 duration-[var(--duration-fast)] hover:bg-foreground/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
            >
              <X size={24} aria-hidden="true" />
            </button>
          </div>
        </form>

        <div className="overflow-y-auto">
          <div className="mx-auto max-w-shell px-4 pb-8 pt-6 md:px-8 xl:px-12">
            {failed ? (
              <p role="alert" className={NOTE}>
                No pudimos buscar en este momento. Revisa tu conexión e intenta de nuevo.
              </p>
            ) : payload === null ? (
              <div aria-hidden="true" className={GRID}>
                {INITIAL_PLACEHOLDERS.map((index) => (
                  <SkeletonBlock key={index} className="h-24 rounded-md md:aspect-[4/5] md:h-auto" />
                ))}
              </div>
            ) : noMatches ? (
              <p className={NOTE}>
                No encontramos nada con «{term}». Prueba con otra palabra, una marca o una categoría.
              </p>
            ) : items.length > 0 ? (
              <section aria-busy={loading}>
                <h2 className="mb-5 font-mono text-label uppercase text-muted-foreground-strong">{HEADINGS[payload.kind]}</h2>
                <ul
                  className={`${GRID} transition-opacity duration-[var(--duration-fast)] motion-reduce:transition-none ${loading ? "opacity-50" : ""}`}
                >
                  {items.map((item) => (
                    <li key={item.id}>
                      <SearchResultCard item={item} onNavigate={onClose} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <p className={NOTE}>Escribe para buscar por producto, marca o categoría.</p>
            )}
            <p role="status" className="sr-only">
              {!loading && payload?.kind === "results"
                ? `${items.length} ${items.length === 1 ? "resultado" : "resultados"}`
                : ""}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export { SearchPanel };
