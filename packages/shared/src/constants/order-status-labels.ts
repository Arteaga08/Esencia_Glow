import { OrderStatus } from "../enums/order-status.js";

/**
 * Etiquetas en español de cada estado, como `Record` exhaustivo — no una
 * función con `default`. Agregar un estado a `OrderStatus` sin etiquetarlo
 * aquí rompe el typecheck en vez de renderizar `undefined` en el panel.
 * Backend y panel (Milestone 2.4) espejan este mapa verbatim.
 */
const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: "Pendiente de pago",
  [OrderStatus.PAID]: "Pagada",
  [OrderStatus.PROCESSING]: "En preparación",
  [OrderStatus.SHIPPED]: "Enviada",
  [OrderStatus.DELIVERED]: "Entregada",
  [OrderStatus.CANCELLED]: "Cancelada",
  [OrderStatus.REFUNDED]: "Reembolsada",
};

export { ORDER_STATUS_LABELS };
