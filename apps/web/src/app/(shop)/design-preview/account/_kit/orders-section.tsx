import Link from "next/link";
import { Package } from "@phosphor-icons/react/ssr";
import { Badge, type BadgeColorValue } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { formatMoneyMXN } from "@/lib/format-money";
import { formatCompactDate, formatLongDate } from "./dates";
import type { DemoAddress, DemoOrder, DemoOrderStatus } from "./fixture";
import { Item, ItemList, Thumb, type Tone } from "./frame";
import { previewHref } from "./preview-state";
import { CTA_PRIMARY, CTA_SECONDARY, LABEL, TEXT_LINK } from "./styles";

const STATUS: Record<DemoOrderStatus, { label: string; color: BadgeColorValue }> = {
  pending: { label: "Pendiente de pago", color: "warning" },
  preparing: { label: "Preparando", color: "neutral" },
  shipped: { label: "Enviado", color: "primary" },
  delivered: { label: "Entregado", color: "success" },
};

interface OrdersSectionProps {
  tone: Tone;
  state: string | null;
  base: string;
  orders: DemoOrder[];
  address: DemoAddress;
}

function summarize(order: DemoOrder): string {
  const [first, ...rest] = order.lines;
  if (!first) return "";
  return rest.length === 0 ? first.name : `${first.name} y ${rest.length} más`;
}

function OrderRow({ tone, order, detailHref }: { tone: Tone; order: DemoOrder; detailHref: string }) {
  const status = STATUS[order.status];

  return (
    <Item tone={tone} className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex shrink-0 -space-x-3">
        {order.lines.slice(0, 3).map((line) => (
          <Thumb key={line.id} product={line} className="h-[70px] w-14 ring-2 ring-surface" sizes="56px" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="font-mono text-data text-foreground">{order.number}</p>
          <Badge color={status.color}>{status.label}</Badge>
        </div>
        <p className="mt-1 truncate text-body text-foreground">{summarize(order)}</p>
        <p className="text-body-sm text-muted-foreground-strong">
          {formatCompactDate(order.createdAt)}
          {order.oxxo ? `. Paga en OXXO antes del ${formatCompactDate(order.oxxo.expiresAt)}` : ""}
        </p>
      </div>
      <div className="flex items-center justify-between gap-6 sm:flex-col sm:items-end sm:gap-1">
        <p className="font-mono text-data text-foreground">{formatMoneyMXN(order.totalCents)}</p>
        <Link href={detailHref} className={TEXT_LINK}>
          Ver detalle
        </Link>
      </div>
    </Item>
  );
}

function trackingEvents(order: DemoOrder): TimelineItem[] {
  const events: TimelineItem[] = [{ id: "e1", title: "Pedido recibido", at: order.createdAt }];
  if (order.status === "pending") return events;
  events.push({ id: "e2", title: "Pago confirmado", at: "2026-09-28T16:07:00Z", tone: "success" });
  events.push({ id: "e3", title: "Preparando tu pedido", at: "2026-09-29T09:30:00Z" });
  events.push({ id: "e4", title: `Enviado con ${order.shipping}`, at: "2026-09-30T13:10:00Z", description: `Guía ${order.trackingNumber}` });
  events.push({ id: "e5", title: "En tránsito", at: "2026-10-01T08:45:00Z", description: "Salió de la central de Guadalajara." });
  return events;
}

function OrderDetail({ order, address, backHref }: { order: DemoOrder; address: DemoAddress; backHref: string }) {
  const status = STATUS[order.status];
  const street = [address.street, address.exteriorNumber, address.interiorNumber].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-8">
      <Link href={backHref} className={`${TEXT_LINK} self-start`}>
        Volver a mis pedidos
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-subtitle text-foreground">{order.number}</p>
          <p className="text-body-sm text-muted-foreground-strong">Hecho el {formatLongDate(order.createdAt)}</p>
        </div>
        <Badge color={status.color}>{status.label}</Badge>
      </header>

      {order.oxxo ? (
        <section aria-labelledby="oxxo-title" className="rounded-md bg-accent p-5 text-accent-foreground-strong md:p-6">
          <h2 id="oxxo-title" className="text-subtitle">
            Falta pagar en OXXO
          </h2>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.06em]">Referencia de pago</p>
          <p className="font-mono text-page-title">{order.oxxo.reference}</p>
          <p className="mt-2 text-body">
            Paga {formatMoneyMXN(order.totalCents)} en cualquier OXXO antes del {formatLongDate(order.oxxo.expiresAt)}. Tu pedido se confirma el siguiente día hábil después de pagar.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link href="#" className={CTA_PRIMARY}>
              Ver ficha de pago
            </Link>
            <Link href="#" className={`${TEXT_LINK} !text-accent-foreground-strong`}>
              Cancelar pedido
            </Link>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="items-title">
        <h2 id="items-title" className={LABEL}>
          Productos
        </h2>
        <ul className="mt-3 flex flex-col border-t border-border-strong">
          {order.lines.map((line) => (
            <li key={line.id} className="flex items-center gap-4 border-b border-border py-4">
              <Thumb product={line} className="h-[75px] w-[60px]" sizes="60px" />
              <div className="min-w-0 flex-1">
                {line.brand ? <p className="font-mono text-label uppercase text-muted-foreground-strong">{line.brand}</p> : null}
                <p className="truncate text-body text-foreground">{line.name}</p>
                <p className="text-body-sm text-muted-foreground-strong">
                  {line.variantLabel}. Cantidad: {line.quantity}
                </p>
              </div>
              <p className="font-mono text-data text-foreground">{formatMoneyMXN(line.priceCents * line.quantity)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-4 ml-auto flex max-w-xs flex-col gap-1.5 text-body">
          <div className="flex justify-between gap-6">
            <dt className="text-foreground/80">Subtotal</dt>
            <dd className="font-mono text-data">{formatMoneyMXN(order.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between gap-6">
            <dt className="text-foreground/80">Envío</dt>
            <dd className="font-mono text-data">{order.shippingCents === 0 ? "Gratis" : formatMoneyMXN(order.shippingCents)}</dd>
          </div>
          <div className="flex justify-between gap-6 border-t border-border-strong pt-2">
            <dt className="font-medium">Total</dt>
            <dd className="font-mono text-data font-medium">{formatMoneyMXN(order.totalCents)}</dd>
          </div>
          <p className="text-right text-body-sm text-muted-foreground-strong">IVA incluido</p>
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
          <p className="mt-2 text-body text-foreground">{order.shipping}</p>
        </div>
        <div>
          <h2 className={LABEL}>Seguimiento</h2>
          <div className="mt-3">
            <Timeline items={trackingEvents(order)} emptyMessage="Aún no hay movimientos." />
          </div>
          {order.trackingNumber ? (
            <Link href="#" className={`${CTA_SECONDARY} mt-4`}>
              Rastrear paquete
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/** Historial de pedidos: lista, vacía, detalle con rastreo y ficha OXXO pendiente. */
function OrdersSection({ tone, state, base, orders, address }: OrdersSectionProps) {
  const list = previewHref(base, "pedidos");

  if (state === "vacia") {
    return (
      <EmptyState
        icon={Package}
        title="Todavía no has comprado"
        description="Cuando hagas tu primer pedido lo verás aquí, con su seguimiento."
        action={
          <Link href="/" className={CTA_SECONDARY}>
            Ir a la tienda
          </Link>
        }
      />
    );
  }

  if (state === "detalle") {
    const shipped = orders.find((order) => order.status === "shipped") ?? orders[0]!;
    return <OrderDetail order={shipped} address={address} backHref={list} />;
  }

  if (state === "oxxo") {
    const pending = orders.find((order) => order.oxxo) ?? orders[0]!;
    return <OrderDetail order={pending} address={address} backHref={list} />;
  }

  return (
    <ItemList tone={tone}>
      {orders.map((order) => (
        <OrderRow key={order.id} tone={tone} order={order} detailHref={previewHref(base, "pedidos", order.oxxo ? "oxxo" : "detalle")} />
      ))}
    </ItemList>
  );
}

export { OrdersSection, STATUS as ORDER_STATUS };
