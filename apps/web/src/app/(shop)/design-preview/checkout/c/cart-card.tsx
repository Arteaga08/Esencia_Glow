"use client";

import { QuantityStepper } from "@/components/storefront/product/quantity-stepper";
import { FieldError } from "@/components/ui/field-error";
import { formatMoneyMXN } from "@/lib/format-money";
import { FOCUS, LABEL } from "../_kit/cta-styles";
import { LineThumb } from "../_kit/line-thumb";
import type { PreviewLine } from "../_kit/preview-types";

interface CartCardProps {
  line: PreviewLine;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

/**
 * Línea del carrito como la tarjeta del estante: foto grande arriba y datos
 * debajo. Hace que revisar el carrito se sienta como seguir mirando producto,
 * no como llenar una planilla.
 */
function CartCard({ line, onQuantityChange, onRemove }: CartCardProps) {
  return (
    <li className="flex flex-col">
      <LineThumb line={line} className="aspect-[4/5] w-full" sizes="(min-width: 1280px) 22vw, (min-width: 640px) 42vw, 100vw" />
      <div className="flex flex-1 flex-col pt-4">
        <p className={LABEL}>{line.kind === "kit" ? "Kit" : (line.brand ?? "Esencia Glow")}</p>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="text-subtitle text-foreground">{line.name}</p>
          <p className={`shrink-0 font-mono text-data tabular-nums ${line.available ? "text-foreground" : "text-muted-foreground-strong line-through"}`}>
            {formatMoneyMXN(line.priceCents * line.quantity)}
          </p>
        </div>
        <p className="text-body-sm text-muted-foreground-strong">{line.variantLabel}</p>
        {!line.available ? <div className="mt-2"><FieldError message="Se agotó. Quítalo para continuar con tu compra." /></div> : null}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4">
          {line.available ? <QuantityStepper value={line.quantity} onChange={onQuantityChange} /> : null}
          <button
            type="button"
            aria-label={`Quitar ${line.name} del carrito`}
            onClick={onRemove}
            className={`inline-flex min-h-11 cursor-pointer items-center text-body-sm text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground ${FOCUS}`}
          >
            Quitar
          </button>
        </div>
      </div>
    </li>
  );
}

export { CartCard };
