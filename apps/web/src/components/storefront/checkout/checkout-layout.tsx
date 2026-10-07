import type { ReactNode } from "react";
import type { CartRowLine } from "../cart/cart-line-row";
import type { CartTotals } from "@/lib/storefront/cart/cart-view";
import { SummaryBody, SummaryDisclosure } from "./checkout-summary";

interface CheckoutLayoutProps {
  title: string;
  lines: readonly CartRowLine[];
  totals: CartTotals;
  /** Campo de cupón del resumen; se muestra en el resumen de escritorio y en el plegable de móvil. */
  coupon?: ReactNode;
  children: ReactNode;
}

/**
 * Marco de la página única (propuesta A): pasos a la izquierda y resumen fijo a
 * la derecha; en móvil, el resumen se pliega arriba con el total a la vista.
 */
function CheckoutLayout({ title, lines, totals, coupon, children }: CheckoutLayoutProps) {
  const summary = <SummaryBody lines={lines} totals={totals} coupon={coupon} />;

  return (
    <main className="pt-16 pb-32 xl:pt-20">
      <SummaryDisclosure totalCents={totals.totalCents} className="border-t-0 lg:hidden">
        {summary}
      </SummaryDisclosure>

      <div className="mx-auto grid max-w-shell gap-12 px-4 py-10 md:px-8 md:py-14 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16 xl:px-12">
        <div>
          <h1 className="text-page-title text-foreground md:text-display">{title}</h1>
          <div className="mt-8">{children}</div>
        </div>

        <aside className="hidden rounded-md border border-border-strong bg-surface p-6 [--surface-bg:var(--color-surface)] lg:sticky lg:top-28 lg:block lg:self-start">
          <h2 className="mb-5 type-shop-card-title text-foreground">Tu pedido</h2>
          {summary}
        </aside>
      </div>
    </main>
  );
}

export { CheckoutLayout };
