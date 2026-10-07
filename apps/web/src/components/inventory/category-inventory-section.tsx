"use client";

import { useState } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { StockStatus } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminCategory } from "@/lib/types/admin-catalog";
import { InventoryProductRow } from "./inventory-product-row";
import { StockFiguresHeader } from "./stock-figures";
import { STOCK_STATUS_BADGE, formatStatusCount } from "./stock-status";
import { useInventoryList, type InventoryListFilters } from "./use-inventory-list";

const SECTION_PAGE_LIMIT = 10;

interface CategoryInventorySectionProps {
  category: AdminCategory;
  filters: Omit<InventoryListFilters, "categoryId" | "limit">;
  isFiltered: boolean;
  refreshSignal: number;
  onChanged: () => void;
}

/**
 * Un bloque por categoría raíz con su propia petición y paginación
 * (`categoryId` incluye a las subcategorías). Nace cerrado: los badges de
 * Agotado / Stock bajo del encabezado dicen dónde hay algo que surtir y la
 * dueña abre a mano el que le interese.
 */
function CategoryInventorySection({
  category,
  filters,
  isFiltered,
  refreshSignal,
  onChanged,
}: CategoryInventorySectionProps) {
  const { items, statusCounts, meta, setPage, loadError, retry } = useInventoryList(
    { ...filters, categoryId: category.id, limit: SECTION_PAGE_LIMIT },
    refreshSignal,
  );
  const [open, setOpen] = useState(false);

  const panelId = `category-${category.id}`;

  const attention = statusCounts
    ? [StockStatus.OUT, StockStatus.LOW].filter((status) => statusCounts[status] > 0)
    : [];

  return (
    <section className="overflow-hidden rounded-lg border border-border" aria-labelledby={`${panelId}-title`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-4 bg-muted/40 px-4 py-3 text-left hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
      >
        <span className="flex items-center gap-2">
          {open ? (
            <CaretDown size={14} className="text-muted-foreground-strong" aria-hidden="true" />
          ) : (
            <CaretRight size={14} className="text-muted-foreground-strong" aria-hidden="true" />
          )}
          <span id={`${panelId}-title`} className="text-subtitle font-medium text-foreground">
            {category.name}
          </span>
          {category.isActive ? null : <Badge color="neutral">Oculta en tienda</Badge>}
        </span>
        <span className="flex items-center gap-2">
          {attention.map((status) => (
            <Badge key={status} color={STOCK_STATUS_BADGE[status].color}>
              {formatStatusCount(status, statusCounts![status])}
            </Badge>
          ))}
          {meta ? (
            <span className="font-mono text-body-sm tabular-nums text-muted-foreground-strong">
              {meta.total} {meta.total === 1 ? "producto" : "productos"}
            </span>
          ) : (
            <Skeleton className="h-4 w-20" />
          )}
        </span>
      </button>

      {!open ? null : (
        <div id={panelId} className="border-t border-border">
          {loadError ? (
            <ErrorState description={loadError} onRetry={retry} />
          ) : meta === null || items === null ? (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-body-sm text-muted-foreground">
              {isFiltered
                ? "Ningún producto de esta categoría coincide con los filtros."
                : "Esta categoría todavía no tiene productos."}
            </p>
          ) : (
            <>
              <div className="flex items-center gap-4 px-4 pt-3 pb-1">
                <span className="w-3.5 shrink-0" />
                <span className="flex-1" />
                <span className="hidden w-28 shrink-0 sm:block" />
                <StockFiguresHeader />
              </div>
              <ul>
                {items.map((product) => (
                  <InventoryProductRow key={product.productId} product={product} onChanged={onChanged} />
                ))}
              </ul>
              <div className="px-4">
                <Pagination meta={meta} onPageChange={setPage} itemLabel={{ singular: "producto", plural: "productos" }} />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export { CategoryInventorySection };
