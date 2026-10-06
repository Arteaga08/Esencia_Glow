"use client";

import { QuantityStepper } from "@/components/storefront/product/quantity-stepper";
import { FieldError } from "@/components/ui/field-error";
import { formatMoneyMXN } from "@/lib/format-money";
import { FOCUS, LABEL } from "./cta-styles";
import { LineThumb } from "./line-thumb";

type RowSize = "sm" | "md";

/**
 * Lo mínimo que pinta un renglón. `CartLineView` (carrito real) y la línea de
 * ejemplo de la vista previa lo cumplen de forma estructural.
 */
interface CartRowLine {
  kind: "product" | "kit";
  brand?: string;
  name: string;
  variantLabel: string;
  priceCents: number;
  listPriceCents?: number;
  quantity: number;
  image?: { url: string; alt: string };
  available: boolean;
}

interface CartLineRowProps {
  line: CartRowLine;
  size?: RowSize;
  /** Tope de unidades de esta línea (10 por producto, 20 por kit). */
  maxQuantity?: number;
  onQuantityChange?: (quantity: number) => void;
  onRemove?: () => void;
}

const THUMB: Record<RowSize, string> = {
  sm: "h-24 w-20",
  md: "h-36 w-28 sm:h-40 sm:w-32",
};

/**
 * Renglón del carrito. Con `onQuantityChange` y `onRemove` es editable (panel
 * y página del carrito); sin ellos es de solo lectura (resumen del checkout).
 * Una línea agotada lo dice con texto pegado al renglón y no suma al total.
 */
function CartLineRow({ line, size = "md", maxQuantity = 10, onQuantityChange, onRemove }: CartLineRowProps) {
  const editable = Boolean(onQuantityChange && onRemove);
  const lineTotal = line.priceCents * line.quantity;

  return (
    <li className="flex gap-4">
      <LineThumb line={line} className={THUMB[size]} sizes="144px" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={LABEL}>{line.kind === "kit" ? "Kit" : (line.brand ?? "Esencia Glow")}</p>
            <p className="mt-0.5 text-subtitle text-foreground">{line.name}</p>
            <p className="text-body-sm text-muted-foreground-strong">{line.variantLabel}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className={`font-mono text-data tabular-nums ${line.available ? "text-foreground" : "text-muted-foreground-strong line-through"}`}>
              {formatMoneyMXN(lineTotal)}
            </p>
            {line.listPriceCents && line.available ? (
              <s className="font-mono text-label text-muted-foreground-strong tabular-nums">{formatMoneyMXN(line.listPriceCents * line.quantity)}</s>
            ) : null}
          </div>
        </div>

        {!line.available ? <div className="mt-2"><FieldError message="Se agotó. Quítalo para continuar con tu compra." /></div> : null}

        {editable ? (
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3">
            {line.available ? <QuantityStepper value={line.quantity} max={maxQuantity} onChange={onQuantityChange!} /> : null}
            <button
              type="button"
              aria-label={`Quitar ${line.name} del carrito`}
              onClick={onRemove}
              className={`inline-flex min-h-11 cursor-pointer items-center text-body-sm text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground ${FOCUS}`}
            >
              Quitar
            </button>
            {line.available && line.quantity >= maxQuantity ? (
              <p role="status" className="basis-full text-body-sm text-muted-foreground-strong">
                Máximo {maxQuantity} por pedido.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-auto pt-2 text-body-sm text-muted-foreground-strong">
            Cantidad: <span className="font-mono tabular-nums">{line.quantity}</span>
          </p>
        )}
      </div>
    </li>
  );
}

export { CartLineRow };
export type { CartRowLine };
