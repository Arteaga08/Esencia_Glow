import { CaretDown } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";
import { formatMoneyMXN } from "@/lib/format-money";
import { CartLineRow } from "@/components/storefront/cart/cart-line-row";
import { FOCUS } from "@/components/storefront/cart/cta-styles";
import type { PreviewLine } from "./preview-types";
import { TotalsList } from "@/components/storefront/cart/totals-list";
import type { PreviewTotals } from "./totals";

interface SummaryBodyProps {
  lines: PreviewLine[];
  totals: PreviewTotals;
}

/** Lo que se compra y lo que se paga, de solo lectura: acompaña a los pasos del checkout. */
function SummaryBody({ lines, totals }: SummaryBodyProps) {
  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-5">
        {lines.filter((line) => line.available).map((line) => (
          <CartLineRow key={line.id} line={line} size="sm" />
        ))}
      </ul>
      <TotalsList totals={totals} />
    </div>
  );
}

interface SummaryDisclosureProps {
  totals: PreviewTotals;
  children: ReactNode;
  className?: string;
}

/**
 * Resumen plegable para móvil (`<details>` nativo: teclado y lector de
 * pantalla gratis). Cerrado deja a la vista solo el total, que es lo que la
 * clienta quiere confirmar sin perder el paso en que va.
 */
function SummaryDisclosure({ totals, children, className = "" }: SummaryDisclosureProps) {
  return (
    <details className={`group border-y border-border-strong ${className}`}>
      <summary className={`flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 md:px-8 [&::-webkit-details-marker]:hidden ${FOCUS}`}>
        <span className="flex items-center gap-2 text-body text-foreground">
          Resumen del pedido
          <CaretDown size={16} aria-hidden="true" className="transition-transform duration-[var(--duration-base)] ease-out-quart group-open:rotate-180" />
        </span>
        <span className="font-mono text-subtitle tabular-nums text-foreground">{formatMoneyMXN(totals.totalCents)}</span>
      </summary>
      <div className="px-4 pb-6 pt-2 md:px-8">{children}</div>
    </details>
  );
}

export { SummaryBody, SummaryDisclosure };
