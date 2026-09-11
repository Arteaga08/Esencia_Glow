import { ORDER_STATUS_TO_GROUP, type OrderStatus, type OrderStatusGroup } from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";

/**
 * Conteos por bucket para las tarjetas KPI del panel (§J del plan de 1.5).
 * Lee `ORDER_STATUS_TO_GROUP` — el MISMO arreglo que `?group=` del listado
 * (`order-admin.service.ts`) — para que la tarjeta y el filtro nunca
 * diverjan (el bug concreto que el estándar documenta). Deliberadamente
 * SIN acotar por fecha: una orden atascada dos meses no deja de estarlo
 * porque el admin mire "últimos 30 días".
 */
async function getOrderStatusSummary(): Promise<Record<OrderStatusGroup, number>> {
  const counts = await Order.aggregate<{ _id: OrderStatus; count: number }>([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const countByStatus = new Map(counts.map((row) => [row._id, row.count]));

  const summary: Record<OrderStatusGroup, number> = { action: 0, progress: 0, shipping: 0, problems: 0 };
  for (const [status, group] of Object.entries(ORDER_STATUS_TO_GROUP) as [OrderStatus, OrderStatusGroup][]) {
    summary[group] += countByStatus.get(status) ?? 0;
  }
  return summary;
}

export { getOrderStatusSummary };
