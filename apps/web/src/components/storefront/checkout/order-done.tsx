import Link from "next/link";
import { CheckCircle, Hourglass, XCircle } from "@phosphor-icons/react/ssr";
import { OrderStatus, type PublicOrder } from "@esencia-glow/shared";
import { summarizeOrder } from "@/lib/storefront/checkout/order-summary";
import { rateSummary } from "@/lib/storefront/checkout/shipping-labels";
import { CartLineRow } from "../cart/cart-line-row";
import { CTA_PRIMARY, CTA_SECONDARY } from "../cart/cta-styles";
import { TotalsList } from "../cart/totals-list";
import { PaymentPendingWatch } from "./payment-pending-watch";

interface OrderDoneProps {
  order: PublicOrder;
  firstName: string;
  email: string;
}

function Heading({ order, firstName, email }: OrderDoneProps) {
  if (order.status === OrderStatus.PENDING) {
    return (
      <header>
        <span className="flex size-12 items-center justify-center rounded-md bg-muted text-foreground">
          <Hourglass size={28} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-page-title text-foreground md:text-display">Estamos confirmando tu pago</h1>
        <div className="mt-2 max-w-[60ch]">
          <PaymentPendingWatch orderId={order.id} />
        </div>
      </header>
    );
  }

  if (order.status === OrderStatus.CANCELLED) {
    return (
      <header>
        <span className="flex size-12 items-center justify-center rounded-md bg-accent text-accent-foreground-strong">
          <XCircle size={28} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-page-title text-foreground md:text-display">Este pedido se canceló</h1>
        <p className="mt-2 max-w-[60ch] text-body text-foreground/80">
          El pedido {order.orderNumber} ya no se va a cobrar ni a enviar. Si fue un error, puedes volver a hacer tu compra.
        </p>
      </header>
    );
  }

  return (
    <header>
      <span className="flex size-12 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
        <CheckCircle size={28} aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-page-title text-foreground md:text-display">Gracias por tu compra, {firstName}</h1>
      <p className="mt-2 max-w-[60ch] text-body text-foreground/80">
        Recibimos tu pago. Tu pedido {order.orderNumber} ya está en preparación y te enviamos el recibo a {email}.
      </p>
    </header>
  );
}

/**
 * Confirmación del pedido. Repite lo comprado, a dónde va y el total (con el
 * ticket de totales a la derecha de los productos en escritorio) para que no
 * haga falta abrir el correo. Lo que dice depende del estado REAL del pedido: el
 * pago solo se da por recibido cuando el webhook lo confirmó.
 */
function OrderDone({ order, firstName, email }: OrderDoneProps) {
  const { lines, totals } = summarizeOrder(order);
  const address = order.shippingAddress;
  const street = [address.street, address.exteriorNumber, address.interiorNumber].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-10">
      <Heading order={order} firstName={firstName} email={email} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-16">
        <div className="flex flex-col gap-10">
          <section aria-labelledby="done-lines" className="flex flex-col gap-5">
            <h2 id="done-lines" className="text-section-title text-foreground">
              Tu pedido
            </h2>
            <ul className="flex flex-col gap-5">
              {lines.map((line, index) => (
                <CartLineRow key={`${line.name}-${index}`} line={line} size="sm" />
              ))}
            </ul>
          </section>

          <section aria-labelledby="done-shipping" className="flex flex-col gap-2">
            <h2 id="done-shipping" className="text-section-title text-foreground">
              Envío
            </h2>
            <p className="text-body text-foreground">{address.fullName}</p>
            <p className="text-body-sm text-muted-foreground-strong">
              {street}, {address.neighborhood}. {address.city}, {address.state}, {address.postalCode}
            </p>
            <p className="text-body-sm text-foreground">{rateSummary(order.shippingSelection)}</p>
          </section>
        </div>

        <aside className="rounded-md border border-border-strong bg-surface p-6 lg:sticky lg:top-28">
          <h2 className="mb-5 type-shop-card-title text-foreground">Resumen</h2>
          <TotalsList totals={totals} />
        </aside>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/mi-cuenta/pedidos" className={CTA_PRIMARY}>
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
