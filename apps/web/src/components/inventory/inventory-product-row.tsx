"use client";

import { useState } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import type { PanelProductRow } from "@/lib/types/admin-inventory";
import { ProductThumbnail } from "./product-thumbnail";
import { ProductVariantsPanel } from "./product-variants-panel";
import { StockFigures } from "./stock-figures";
import { STOCK_STATUS_BADGE } from "./stock-status";

interface InventoryProductRowProps {
  product: PanelProductRow;
  onChanged: () => void;
}

function describeVariants(product: PanelProductRow): string {
  const skus = `${product.variantCount} SKU`;
  if (product.untrackedVariantCount === 0) return skus;
  return `${skus}, ${product.untrackedVariantCount} sin registro`;
}

/**
 * Fila de producto: miniatura de la portada, dos renglones (nombre;
 * subcategoría y cuántos SKU), estado y cifras agregadas a la derecha. Toda
 * la fila abre las variantes en línea: el stock se ajusta por variante y el
 * `variantId` solo llega con el detalle. El panel de variantes se sangra
 * hasta la columna del nombre (px + caret + miniatura y sus huecos).
 */
function InventoryProductRow({ product, onChanged }: InventoryProductRowProps) {
  const [open, setOpen] = useState(false);
  const badge = STOCK_STATUS_BADGE[product.status];
  const panelId = `variants-${product.productId}`;

  return (
    <li className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-[var(--duration-fast)] hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
      >
        {open ? (
          <CaretDown size={14} className="shrink-0 text-muted-foreground-strong" aria-hidden="true" />
        ) : (
          <CaretRight size={14} className="shrink-0 text-muted-foreground-strong" aria-hidden="true" />
        )}
        <ProductThumbnail image={product.image} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body text-foreground">{product.name}</span>
          <span className="truncate text-body-sm text-muted-foreground">
            {product.category ? `${product.category.name}, ` : ""}
            {describeVariants(product)}
          </span>
        </span>
        <span className="hidden w-28 shrink-0 justify-end sm:flex">
          <Badge color={badge.color}>{badge.label}</Badge>
        </span>
        <StockFigures onHand={product.totalOnHand} reserved={product.totalReserved} available={product.totalAvailable} />
      </button>
      {open ? (
        <div id={panelId} className="border-t border-border bg-surface px-4 pb-2 pl-[6.375rem]">
          <ProductVariantsPanel productId={product.productId} onChanged={onChanged} />
        </div>
      ) : null}
    </li>
  );
}

export { InventoryProductRow };
