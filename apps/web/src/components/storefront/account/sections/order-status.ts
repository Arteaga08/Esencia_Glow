import { OrderStatus } from "@esencia-glow/shared";
import type { BadgeColorValue } from "@/components/ui/badge";

/** Color de la etiqueta de cada estado de pedido; el texto sale de `ORDER_STATUS_LABELS` (shared). */
const ORDER_STATUS_COLOR: Record<OrderStatus, BadgeColorValue> = {
  [OrderStatus.PENDING]: "warning",
  [OrderStatus.PAID]: "neutral",
  [OrderStatus.PROCESSING]: "neutral",
  [OrderStatus.SHIPPED]: "primary",
  [OrderStatus.DELIVERED]: "success",
  [OrderStatus.CANCELLED]: "danger",
  [OrderStatus.REFUNDED]: "neutral",
};

export { ORDER_STATUS_COLOR };
