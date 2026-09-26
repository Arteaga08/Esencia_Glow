import { OrderPriority } from "../enums/order-priority.js";

/**
 * Etiquetas en español de la prioridad de una orden, como `Record`
 * exhaustivo. Absorbe el hardcodeo que vivía duplicado en
 * `order-row.tsx` y `orders/page.tsx` del panel.
 */
const ORDER_PRIORITY_LABELS: Record<OrderPriority, string> = {
  [OrderPriority.NORMAL]: "Normal",
  [OrderPriority.HIGH]: "Alta",
  [OrderPriority.URGENT]: "Urgente",
};

export { ORDER_PRIORITY_LABELS };
