"use client";

import { X } from "@phosphor-icons/react";
import type { PublicProductFacets } from "@esencia-glow/shared";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CTA_PRIMARY, FOCUS, TEXT_LINK } from "@/components/storefront/cart/cta-styles";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { PRODUCT_COPY, type CatalogCopy } from "./catalog-copy";
import { BrandField, PriceField, SortField } from "./filter-fields";
import type { CatalogFilterState } from "./use-catalog-navigation";

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  state: CatalogFilterState;
  facets: PublicProductFacets;
  total: number;
  copy?: CatalogCopy;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border-strong px-5 py-6 last:border-b-0">
      <h3 className="mb-3 type-shop-cta text-foreground">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Panel lateral de "Filtrar": Ordenar, Marca y Precio apilados. Cada cambio se
 * aplica al momento (la URL manda), así que "Ver N productos" solo cierra el
 * panel con el conteo ya actualizado. Mismo comportamiento que el carrito:
 * foco atrapado, Escape y clic fuera lo cierran y la página no se desplaza.
 * Va en un portal al <body>: la barra pegajosa que lo abre crea su propio
 * contexto de apilamiento (z-30) y lo dejaría debajo del header.
 */
function FilterDrawer({ open, onClose, state, facets, total, copy = PRODUCT_COPY }: FilterDrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Sin marcas o sin rango de precio (categoría vacía o API caído) ese filtro no tiene qué ofrecer.
  const hasPriceRange = facets.minPrice !== null && facets.maxPrice !== null && facets.minPrice < facets.maxPrice;
  const countLabel = `${total} ${total === 1 ? copy.countSingular : copy.countPlural}`;

  return createPortal(
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar filtros"
        onClick={onClose}
        className="fixed inset-0 z-[55] cursor-default bg-foreground/25"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filtrar y ordenar"
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col border-l border-border-strong bg-surface shadow-modal"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border-strong px-5">
          <h2 className="type-shop-card-title text-foreground">Filtrar y ordenar</h2>
          <button
            type="button"
            aria-label="Cerrar filtros"
            onClick={onClose}
            className={`inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-foreground/8 ${FOCUS}`}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <Section title="Ordenar por">
            <SortField state={state} />
          </Section>
          {facets.brands.length > 0 ? (
            <Section title="Marca">
              <BrandField state={state} brands={facets.brands} />
            </Section>
          ) : null}
          {hasPriceRange ? (
            <Section title="Precio">
              <PriceField state={state} minPrice={facets.minPrice} maxPrice={facets.maxPrice} />
            </Section>
          ) : null}
        </div>

        <footer className="flex shrink-0 items-center gap-4 border-t border-border-strong p-5">
          {state.activeCount > 0 ? (
            <button type="button" onClick={state.clearFilters} className={TEXT_LINK}>
              Quitar todo
            </button>
          ) : null}
          <button type="button" onClick={onClose} aria-busy={state.isPending} className={`${CTA_PRIMARY} flex-1`}>
            {state.isPending ? "Actualizando…" : `Ver ${countLabel}`}
          </button>
        </footer>
      </aside>
    </>,
    document.body,
  );
}

export { FilterDrawer };
