import { OrderStatus } from "../enums/order-status.js";

/**
 * Buckets que el operador del panel piensa, no el enum crudo de estados
 * (ver DASHBOARD_GUIDELINES.md §10). `satisfies Record<OrderStatus, ...>`
 * obliga a que cada estado pertenezca a EXACTAMENTE uno — agregar un estado
 * nuevo sin decidir su bucket rompe el build en vez de dejarlo huérfano.
 *
 * `/admin/orders/summary` y el filtro `?group=` del listado leen este mismo
 * arreglo: es la fuente única que evita que la tarjeta KPI cuente distinto
 * de lo que el filtro correspondiente termina mostrando.
 */
type OrderStatusGroup = "action" | "progress" | "shipping" | "problems";

const ORDER_STATUS_TO_GROUP = {
  [OrderStatus.PENDING]: "action",
  [OrderStatus.PAID]: "progress",
  [OrderStatus.PROCESSING]: "progress",
  [OrderStatus.SHIPPED]: "shipping",
  [OrderStatus.DELIVERED]: "shipping",
  [OrderStatus.CANCELLED]: "problems",
  [OrderStatus.REFUNDED]: "problems",
} satisfies Record<OrderStatus, OrderStatusGroup>;

const ORDER_STATUS_GROUPS: Record<OrderStatusGroup, OrderStatus[]> = {
  action: [],
  progress: [],
  shipping: [],
  problems: [],
};
for (const [status, group] of Object.entries(ORDER_STATUS_TO_GROUP) as [OrderStatus, OrderStatusGroup][]) {
  ORDER_STATUS_GROUPS[group].push(status);
}

function matchStatusGroup(group: string): OrderStatus[] | undefined {
  return group in ORDER_STATUS_GROUPS ? ORDER_STATUS_GROUPS[group as OrderStatusGroup] : undefined;
}

export { ORDER_STATUS_TO_GROUP, ORDER_STATUS_GROUPS, matchStatusGroup };
export type { OrderStatusGroup };
