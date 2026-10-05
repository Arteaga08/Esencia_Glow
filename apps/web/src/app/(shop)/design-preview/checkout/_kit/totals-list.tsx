import { formatMoneyMXN } from "@/lib/format-money";
import type { PreviewTotals } from "./totals";

interface TotalsListProps {
  totals: PreviewTotals;
  /** Tamaño del total: "lg" para el resumen principal, "md" en espacios chicos. */
  size?: "md" | "lg";
  className?: string;
}

/**
 * Subtotal, envío, IVA y total. El IVA se muestra como desglose ("incluido"),
 * nunca como un cargo que se suma. Sin tarifa elegida el envío dice cuándo se
 * sabrá, no un cero que parezca "gratis".
 */
function TotalsList({ totals, size = "lg", className = "" }: TotalsListProps) {
  const { subtotalCents, shippingCents, taxCents, totalCents } = totals;

  return (
    <dl className={`flex flex-col gap-2 text-body ${className}`}>
      <div className="flex justify-between gap-4">
        <dt className="text-foreground/80">Subtotal</dt>
        <dd className="font-mono tabular-nums">{formatMoneyMXN(subtotalCents)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-foreground/80">Envío</dt>
        <dd className={shippingCents === null ? "text-body-sm text-muted-foreground-strong" : "font-mono tabular-nums"}>
          {shippingCents === null ? "Se calcula al elegir envío" : shippingCents === 0 ? "Gratis" : formatMoneyMXN(shippingCents)}
        </dd>
      </div>
      <div className="flex justify-between gap-4 text-body-sm text-muted-foreground-strong">
        <dt>IVA incluido</dt>
        <dd className="font-mono tabular-nums">{formatMoneyMXN(taxCents)}</dd>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-border-strong pt-4">
        <dt className="text-subtitle text-foreground">Total</dt>
        <dd className={`font-mono tabular-nums text-foreground ${size === "lg" ? "text-[28px] leading-none" : "text-subtitle"}`}>{formatMoneyMXN(totalCents)}</dd>
      </div>
    </dl>
  );
}

export { TotalsList };
