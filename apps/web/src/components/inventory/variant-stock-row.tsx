"use client";

import { useState } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import type { PanelVariantRow } from "@/lib/types/admin-inventory";
import { AdjustStockForm } from "./adjust-stock-form";
import { StockFigures } from "./stock-figures";
import { STOCK_STATUS_BADGE } from "./stock-status";
import { ThresholdForm } from "./threshold-form";

interface VariantStockRowProps {
  productId: string;
  variant: PanelVariantRow;
  onChanged: () => void;
}

/** Una variante: nombre + SKU, estado, cifras, y los formularios de ajuste
 * y umbral detrás de "Ajustar" (divulgación progresiva, sin modal). */
function VariantStockRow({ productId, variant, onChanged }: VariantStockRowProps) {
  const [open, setOpen] = useState(false);
  const isUntracked = variant.inventoryItemId === null;
  const badge = STOCK_STATUS_BADGE[variant.status];

  return (
    <li className="border-t border-border first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body-sm text-foreground">{variant.name}</span>
          <span className="font-mono text-body-sm tabular-nums text-muted-foreground">{variant.sku}</span>
        </div>
        <Badge color={badge.color}>{badge.label}</Badge>
        <StockFigures onHand={variant.onHand} reserved={variant.reserved} available={variant.available} />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-h-11 items-center gap-1 rounded-md px-3 text-body-sm text-primary-action hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
        >
          {open ? <CaretDown size={12} aria-hidden="true" /> : <CaretRight size={12} aria-hidden="true" />}
          {isUntracked ? "Registrar" : "Ajustar"}
        </button>
      </div>
      {open ? (
        <div className="mb-3 flex flex-col gap-5 rounded-md bg-muted/40 p-4 lg:flex-row lg:gap-10">
          <AdjustStockForm productId={productId} variant={variant} onChanged={onChanged} />
          {isUntracked ? null : <ThresholdForm key={variant.lowStockThreshold ?? "global"} variant={variant} onChanged={onChanged} />}
        </div>
      ) : null}
    </li>
  );
}

export { VariantStockRow };
