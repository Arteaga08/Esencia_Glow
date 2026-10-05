import Link from "next/link";
import type { PublicShippingRate } from "@esencia-glow/shared";
import { CheckCircle } from "@phosphor-icons/react/ssr";
import { formatMoneyMXN } from "@/lib/format-money";
import { CartLineRow } from "./cart-line-row";
import { CTA_PRIMARY, CTA_SECONDARY, LABEL } from "./cta-styles";
import type { PreviewData } from "./preview-types";
import { rateSummary } from "./shipping-labels";
import { TotalsList } from "./totals-list";
import type { PreviewTotals } from "./totals";

interface OrderDoneProps {
  data: PreviewData;
  rate: PublicShippingRate;
  totals: PreviewTotals;
  /** Pedido pagado con ficha OXXO: aún no hay pago confirmado. */
  oxxo: boolean;
  /** En escritorio, el ticket de totales va a la derecha de los productos en vez de debajo. */
  split?: boolean;
}

/** Ficha OXXO: la referencia y el plazo, lo único que la clienta debe llevar a la tienda. */
function OxxoVoucher({ totalCents }: { totalCents: number }) {
  return (
    <div className="flex flex-col gap-4 rounded-md border border-border-strong bg-surface p-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className={LABEL}>Referencia OXXO</p>
        <p className="mt-1 font-mono text-[28px] leading-none tabular-nums text-foreground">9800 1234 5678 90</p>
        <p className="mt-3 text-body-sm text-muted-foreground-strong">
          Paga <span className="font-mono tabular-nums text-foreground">{formatMoneyMXN(totalCents)}</span> antes del 7 de octubre a las 23:59.
        </p>
      </div>
      <Link href="#" className={CTA_SECONDARY}>
        Ver ficha completa
      </Link>
    </div>
  );
}

/**
 * Confirmación del pedido. Con tarjeta dice que el pago llegó; con OXXO dice
 * lo contrario con claridad (el pedido está apartado, no pagado) y muestra la
 * ficha. Repite lo comprado, a dónde va y el total, para que no haga falta
 * abrir el correo.
 */
function OrderDone({ data, rate, totals, oxxo, split = false }: OrderDoneProps) {
  const { address, lines, orderNumber, firstName, email } = data;
  const street = [address.street, address.exteriorNumber, address.interiorNumber].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-10">
      <header>
        <span className="flex size-12 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <CheckCircle size={28} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-page-title text-foreground md:text-display">Gracias por tu compra, {firstName}</h1>
        <p className="mt-2 max-w-[60ch] text-body text-foreground/80">
          {oxxo
            ? `Apartamos tu pedido ${orderNumber}. Págalo en OXXO y lo enviamos en cuanto se confirme.`
            : `Recibimos tu pago. Tu pedido ${orderNumber} ya está en preparación y te enviamos el recibo a ${email}.`}
        </p>
      </header>

      {oxxo ? <OxxoVoucher totalCents={totals.totalCents} /> : null}

      <div className={split ? "grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-16" : "flex flex-col gap-10"}>
        <div className="flex flex-col gap-10">
          <section aria-labelledby="done-lines" className="flex flex-col gap-5">
            <h2 id="done-lines" className="text-section-title text-foreground">
              Tu pedido
            </h2>
            <ul className="flex flex-col gap-5">
              {lines.map((line) => (
                <CartLineRow key={line.id} line={line} size="sm" />
              ))}
            </ul>
            {split ? null : <TotalsList totals={totals} size="md" className="max-w-sm" />}
          </section>

          <section aria-labelledby="done-shipping" className="flex flex-col gap-2">
            <h2 id="done-shipping" className="text-section-title text-foreground">
              Envío
            </h2>
            <p className="text-body text-foreground">{address.fullName}</p>
            <p className="text-body-sm text-muted-foreground-strong">
              {street}, {address.neighborhood}. {address.city}, {address.state}, {address.postalCode}
            </p>
            <p className="text-body-sm text-foreground">{rateSummary(rate)}</p>
          </section>
        </div>

        {split ? (
          <aside className="rounded-md border border-border-strong bg-surface p-6 lg:sticky lg:top-28">
            <h2 className="mb-5 type-shop-card-title text-foreground">Resumen</h2>
            <TotalsList totals={totals} />
          </aside>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/cuenta" className={CTA_PRIMARY}>
          Ver mis pedidos
        </Link>
        <Link href="/" className={CTA_SECONDARY}>
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}

export { OrderDone };
