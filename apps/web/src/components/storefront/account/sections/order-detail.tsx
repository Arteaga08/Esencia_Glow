import Link from "next/link";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  SHIPMENT_TRACKING_STATUS_LABELS,
  SHIPPING_CARRIER_LABELS,
  type PublicOrder,
  type PublicOrderTracking,
} from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { formatMoneyMXN } from "@/lib/format-money";
import { formatLongDate } from "../shared/dates";
import { Thumb } from "../shared/frame";
import { CTA_PRIMARY, CTA_SECONDARY, LABEL, TEXT_LINK } from "../shared/styles";
import { CancelOrderButton } from "./cancel-order-button";
import { ORDER_STATUS_COLOR } from "./order-status";

interface OrderDetailProps {
  order: PublicOrder;
  /** `null` si el rastreo no se pudo traer: el resto del pedido se muestra igual. */
  tracking: PublicOrderTracking | null;
}

function trackingItems(order: PublicOrder, tracking: PublicOrderTracking | null): TimelineItem[] {
  if (tracking && tracking.events.length > 0) {
    return [...tracking.events]
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .map((event, index) => ({
        id: `${event.occurredAt}-${index}`,
        title: SHIPMENT_TRACKING_STATUS_LABELS[event.status],
        at: event.occurredAt,
        description: [event.description, event.location].filter(Boolean).join(". ") || undefined,
      }));
  }
  // Sin eventos de la paquetería: la bitácora del propio pedido (recibido, pagado, enviado…).
  return [...order.statusHistory]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((entry, index) => ({ id: `${entry.at}-${index}`, title: ORDER_STATUS_LABELS[entry.status], at: entry.at }));
}

/** Detalle de un pedido propio: productos, totales, envío y seguimiento. Solo lectura, salvo cancelar si aún no se paga. */
function OrderDetail({ order, tracking }: OrderDetailProps) {
  const address = order.shippingAddress;
  const street = [address.street, address.exteriorNumber, address.interiorNumber].filter(Boolean).join(" ");
  const trackingUrl = order.shipment?.trackingUrl ?? tracking?.trackingUrl;
  const trackingNumber = order.shipment?.trackingNumber ?? tracking?.trackingNumber;
  const carrier = SHIPPING_CARRIER_LABELS[order.shippingSelection.carrier];

  return (
    <div className="flex flex-col gap-8">
      <Link href="/mi-cuenta/pedidos" className={`${TEXT_LINK} self-start`}>
        Volver a mis pedidos
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-subtitle text-foreground">{order.orderNumber}</p>
          <p className="text-body-sm text-muted-foreground-strong">Hecho el {formatLongDate(order.createdAt)}</p>
        </div>
        <Badge color={ORDER_STATUS_COLOR[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
      </header>

      {order.status === "pending" ? (
        <section aria-labelledby="pending-title" className="rounded-md bg-accent p-5 text-accent-foreground-strong md:p-6">
          <h2 id="pending-title" className="text-subtitle">
            Este pedido aún no se paga
          </h2>
          <p className="mt-2 text-body">
            {order.payment.voucherExpiresAt
              ? `Paga ${formatMoneyMXN(order.totals.totalCents)} en OXXO antes del ${formatLongDate(order.payment.voucherExpiresAt)}.`
              : order.expiresAt
                ? `Lo apartamos para ti hasta el ${formatLongDate(order.expiresAt)}.`
                : "Lo apartamos para ti por tiempo limitado."}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link href="/checkout" className={CTA_PRIMARY}>
              Pagar ahora
            </Link>
            <CancelOrderButton orderId={order.id} />
          </div>
        </section>
      ) : null}

      {order.status === "cancelled" && order.cancelReason ? <p className="text-body text-foreground/80">Motivo de la cancelación: {order.cancelReason}</p> : null}

      <section aria-labelledby="items-title">
        <h2 id="items-title" className={LABEL}>
          Productos
        </h2>
        <ul className="mt-3 flex flex-col border-t border-border-strong">
          {order.lines.map((line) => (
            <li key={`${line.itemId}-${line.sku}`} className="flex items-center gap-4 border-b border-border py-4">
              <Thumb name={line.name} image={line.image} className="h-[75px] w-[60px]" sizes="60px" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body text-foreground">{line.name}</p>
                <p className="text-body-sm text-muted-foreground-strong">
                  {line.variantName ? `${line.variantName}. ` : ""}Cantidad: {line.quantity}
                </p>
              </div>
              <p className="font-mono text-data text-foreground">{formatMoneyMXN(line.lineTotalCents)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 ml-auto flex max-w-xs flex-col gap-1.5 text-body">
          <div className="flex justify-between gap-6">
            <dt className="text-foreground/80">Subtotal</dt>
            <dd className="font-mono text-data">{formatMoneyMXN(order.totals.subtotalCents)}</dd>
          </div>
          {order.totals.discountCents > 0 ? (
            <div className="flex justify-between gap-6">
              <dt className="text-foreground/80">Descuento</dt>
              <dd className="font-mono text-data">-{formatMoneyMXN(order.totals.discountCents)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-6">
            <dt className="text-foreground/80">Envío</dt>
            <dd className="font-mono text-data">{order.totals.shippingCents === 0 ? "Gratis" : formatMoneyMXN(order.totals.shippingCents)}</dd>
          </div>
          <div className="flex justify-between gap-6 border-t border-border-strong pt-2">
            <dt className="font-medium">Total</dt>
            <dd className="font-mono text-data font-medium">{formatMoneyMXN(order.totals.totalCents)}</dd>
          </div>
          <p className="text-right text-body-sm text-muted-foreground-strong">IVA incluido · Pago con {PAYMENT_METHOD_LABELS[order.payment.method].toLowerCase()}</p>
        </dl>
      </section>

      <section aria-labelledby="ship-title" className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 id="ship-title" className={LABEL}>
            Envío a
          </h2>
          <address className="mt-2 text-body not-italic text-foreground/80">
            <p className="font-medium text-foreground">{address.fullName}</p>
            <p>{street}</p>
            <p>
              {address.neighborhood}, {address.city}, {address.state}, {address.postalCode}
            </p>
          </address>
          <p className="mt-2 text-body text-foreground">
            {carrier} {order.shippingSelection.service}
          </p>
          {trackingNumber ? <p className="font-mono text-data text-muted-foreground-strong">Guía {trackingNumber}</p> : null}
        </div>
        <div>
          <h2 className={LABEL}>Seguimiento</h2>
          <div className="mt-3">
            <Timeline items={trackingItems(order, tracking)} emptyMessage="Aún no hay movimientos." />
          </div>
          {trackingUrl ? (
            <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className={`${CTA_SECONDARY} mt-4`}>
              Rastrear paquete
            </a>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export { OrderDetail };
