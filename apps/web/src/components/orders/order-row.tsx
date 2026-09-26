import Link from "next/link";
import type { AdminOrder } from "@esencia-glow/shared";
import { ORDER_PRIORITY_LABELS, OrderPriority } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { formatMoneyMXN } from "@/lib/format-money";
import { formatShortDate } from "@/lib/format-date";
import { OrderStatusBadge } from "./order-status-badge";
import { PaymentStateBadge } from "./payment-state-badge";
import { PaymentMethodIcon } from "./payment-method-icon";
import { summarizeOrderLines } from "./summarize-order-lines";

/** Dos renglones, estilo bandeja de entrada (DESIGN.md, densidad sin
 * ruido): folio + cliente + prioridad arriba, artículos + fecha + guía
 * abajo. Lleva al detalle (2.3b): líneas, bitácora y acciones. */
function OrderRow({ order }: { order: AdminOrder }) {
  const customerName = order.customer
    ? `${order.customer.firstName} ${order.customer.lastName}`
    : order.shippingAddress.fullName;

  return (
    <li className="border-t border-border first:border-t-0">
      <Link
        href={`/orders/${order.id}`}
        className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-body-sm tabular-nums text-foreground">{order.orderNumber}</span>
            <span className="truncate text-body text-foreground">{customerName}</span>
            {order.priority !== OrderPriority.NORMAL ? (
              <Badge color={order.priority === OrderPriority.URGENT ? "danger" : "warning"}>
                {ORDER_PRIORITY_LABELS[order.priority]}
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">
            <span>{summarizeOrderLines(order.lines)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatShortDate(order.createdAt)}</span>
            {order.label?.trackingNumber ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{order.label.trackingNumber}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <PaymentMethodIcon method={order.payment.method} />
          <OrderStatusBadge status={order.status} />
          <PaymentStateBadge state={order.payment.state} />
          <span className="w-24 text-right font-mono text-body-sm tabular-nums text-foreground">
            {formatMoneyMXN(order.totals.totalCents)}
          </span>
        </div>
      </Link>
    </li>
  );
}

export { OrderRow };
