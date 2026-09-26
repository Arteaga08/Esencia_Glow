import { OrderStatus, ORDER_STATUS_LABELS } from "@esencia-glow/shared";
import { Badge, type BadgeColorValue } from "@/components/ui/badge";

/**
 * DESIGN.md §5 Badge: `secondary` (menta) solo para pagado/entregado —
 * los estados positivos reales. `processing`/`shipped` son tránsito, no
 * logro, así que quedan neutros; `pending` es atención (mantequilla);
 * cancelado/reembolsado es negativo.
 */
const STATUS_COLOR: Record<OrderStatus, BadgeColorValue> = {
  [OrderStatus.PENDING]: "warning",
  [OrderStatus.PAID]: "success",
  [OrderStatus.PROCESSING]: "neutral",
  [OrderStatus.SHIPPED]: "neutral",
  [OrderStatus.DELIVERED]: "success",
  [OrderStatus.CANCELLED]: "danger",
  [OrderStatus.REFUNDED]: "danger",
};

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge color={STATUS_COLOR[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

export { OrderStatusBadge };
