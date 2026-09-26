import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { DisputeStatus, ORDER_PRIORITY_LABELS, OrderPriority, type AdminOrder } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { formatMoneyMXN } from "@/lib/format-money";
import { formatDateTime } from "@/lib/format-date";
import { OrderStatusBadge } from "../order-status-badge";
import { PaymentStateBadge } from "../payment-state-badge";

/** El `<h1>` de la página lo pone `TopBar` derivado de la ruta ("Pedidos") —
 * este encabezado es identidad del pedido, no el título de la sección. */
function OrderDetailHeader({ order }: { order: AdminOrder }) {
  return (
    <div className="flex flex-col gap-2">
      <Link
        href="/orders"
        className="inline-flex w-fit items-center gap-1.5 text-body-sm text-muted-foreground-strong hover:text-foreground"
      >
        <ArrowLeft size={14} weight="regular" aria-hidden="true" />
        Pedidos
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-section-title tabular-nums text-foreground">{order.orderNumber}</span>
          <OrderStatusBadge status={order.status} />
          <PaymentStateBadge state={order.payment.state} />
          {order.priority !== OrderPriority.NORMAL ? (
            <Badge color={order.priority === OrderPriority.URGENT ? "danger" : "warning"}>
              {ORDER_PRIORITY_LABELS[order.priority]}
            </Badge>
          ) : null}
          {order.disputeStatus === DisputeStatus.OPEN ? <Badge color="danger">Contracargo abierto</Badge> : null}
        </div>
        <div className="flex flex-col items-end">
          <span className="font-mono text-section-title tabular-nums text-foreground">
            {formatMoneyMXN(order.totals.totalCents)}
          </span>
          <span className="text-body-sm text-muted-foreground">{formatDateTime(order.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

export { OrderDetailHeader };
