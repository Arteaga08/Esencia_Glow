"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { PaginationMeta } from "@esencia-glow/shared";

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  /** Sustantivo del conteo total, singular/plural — default "producto"/
   * "productos" para no romper las pantallas que ya lo usaban así antes de
   * que este prop existiera (Productos, Badges). */
  itemLabel?: { singular: string; plural: string };
}

const DEFAULT_ITEM_LABEL = { singular: "producto", plural: "productos" };

/**
 * Paginación simple anterior/siguiente + "página X de Y" — el panel lo usa
 * un solo operador (PRODUCT.md §Users), así que no hace falta un rango de
 * números de página clickeables, solo moverse con certeza de dónde está.
 */
function Pagination({ meta, onPageChange, itemLabel = DEFAULT_ITEM_LABEL }: PaginationProps) {
  if (meta.pages <= 1) return null;

  return (
    <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
      <p className="text-body-sm text-muted-foreground-strong">
        {meta.total} {meta.total === 1 ? itemLabel.singular : itemLabel.plural} · página {meta.page} de{" "}
        {meta.pages}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(meta.page - 1)}
          disabled={meta.page <= 1}
          aria-label="Página anterior"
          className="flex items-center gap-1 rounded-md border border-border-strong px-3 py-1.5 text-body-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <CaretLeft size={14} aria-hidden="true" />
          Anterior
        </button>
        <button
          type="button"
          onClick={() => onPageChange(meta.page + 1)}
          disabled={meta.page >= meta.pages}
          aria-label="Página siguiente"
          className="flex items-center gap-1 rounded-md border border-border-strong px-3 py-1.5 text-body-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
        >
          Siguiente
          <CaretRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export type { PaginationProps };
export { Pagination };
