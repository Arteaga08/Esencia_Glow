import type { PublicOrderTotals } from "@esencia-glow/shared";
import { formatMoneyMXN } from "@/lib/format-money";

interface TotalRowProps {
  label: string;
  amountCents: number;
  strong?: boolean;
}

function TotalRow({ label, amountCents, strong = false }: TotalRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "text-body text-foreground" : "text-body-sm text-muted-foreground-strong"}>
        {label}
      </span>
      <span
        className={
          "font-mono tabular-nums " + (strong ? "text-body text-foreground" : "text-body-sm text-foreground")
        }
      >
        {formatMoneyMXN(amountCents)}
      </span>
    </div>
  );
}

/** Desglose de totales del pedido — vive junto a `OrderLinesCard` en el
 * mismo bloque visual (Artículos y totales). */
function OrderTotals({ totals }: { totals: PublicOrderTotals }) {
  return (
    <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4">
      <TotalRow label="Subtotal" amountCents={totals.subtotalCents} />
      {totals.discountCents > 0 ? <TotalRow label="Descuento" amountCents={-totals.discountCents} /> : null}
      <TotalRow label={`Impuesto (${(totals.taxRateBps / 100).toFixed(1)}%)`} amountCents={totals.taxCents} />
      <TotalRow label="Envío" amountCents={totals.shippingCents} />
      <TotalRow label="Total" amountCents={totals.totalCents} strong />
    </div>
  );
}

export { OrderTotals };
