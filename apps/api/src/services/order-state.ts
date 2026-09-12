import { OrderStatus } from "@esencia-glow/shared";
import { AppError } from "../utils/app-error.js";

/**
 * Máquina de estados de `Order` — tabla como dato, pura y sin I/O. Ningún
 * código escribe `status` directo: toda transición pasa por
 * `assertTransition` (ver ECOMMERCE_ARCHITECTURE_GUIDELINES.md
 * §"Módulo de Órdenes"). Sin escape hatch, sin flag `force`.
 *
 * `refunded` NO es un `releaseReservation`: para cuando se llega ahí, la
 * reserva de stock ya está `committed` (el dinero se cobró). Devolver
 * inventario en ese punto es un movimiento de restock (ver
 * reservation-restock.service.ts, Milestone 1.6.3), no una liberación de
 * reserva.
 *
 * `restock` solo aplica desde `paid`/`processing` (el pedido no se ha
 * enviado): desde `shipped`/`delivered` el efecto es `none` — el paquete ya
 * puede estar en tránsito o en manos de la clienta, así que el stock NO
 * vuelve solo; si el producto regresa en buen estado, el admin lo ajusta a
 * mano con `adjustStock` (decisión 3 del plan de 1.6).
 */

type OrderActor = "customer" | "admin" | "system";
type InventoryEffect = "commit" | "release" | "restock" | "none";

const ALL_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
];

/**
 * Cancelar solo existe desde `pending`. No es una simplificación temporal:
 * si `cancelled` fuera alcanzable desde `paid`, ese mismo estado
 * significaría dos efectos de inventario distintos (release vs. restock) y
 * el barrendero de expiración ya no podría tratar el release como
 * idempotente. Un estado, un efecto — el dinero ya cobrado regresa por
 * `refunded`, nunca por `cancelled`.
 */
const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.REFUNDED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.REFUNDED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.REFUNDED],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

const TRANSITION_ACTORS: Readonly<Record<string, readonly OrderActor[]>> = {
  [`${OrderStatus.PENDING}->${OrderStatus.PAID}`]: ["system"],
  [`${OrderStatus.PENDING}->${OrderStatus.CANCELLED}`]: ["customer", "admin", "system"],
  [`${OrderStatus.PAID}->${OrderStatus.PROCESSING}`]: ["admin"],
  [`${OrderStatus.PROCESSING}->${OrderStatus.SHIPPED}`]: ["admin"],
  [`${OrderStatus.SHIPPED}->${OrderStatus.DELIVERED}`]: ["admin"],
  [`${OrderStatus.PAID}->${OrderStatus.REFUNDED}`]: ["system"],
  [`${OrderStatus.PROCESSING}->${OrderStatus.REFUNDED}`]: ["system"],
  [`${OrderStatus.SHIPPED}->${OrderStatus.REFUNDED}`]: ["system"],
  [`${OrderStatus.DELIVERED}->${OrderStatus.REFUNDED}`]: ["system"],
};

const TRANSITION_INVENTORY_EFFECT: Readonly<Record<string, InventoryEffect>> = {
  [`${OrderStatus.PENDING}->${OrderStatus.PAID}`]: "commit",
  [`${OrderStatus.PENDING}->${OrderStatus.CANCELLED}`]: "release",
  [`${OrderStatus.PAID}->${OrderStatus.PROCESSING}`]: "none",
  [`${OrderStatus.PROCESSING}->${OrderStatus.SHIPPED}`]: "none",
  [`${OrderStatus.SHIPPED}->${OrderStatus.DELIVERED}`]: "none",
  [`${OrderStatus.PAID}->${OrderStatus.REFUNDED}`]: "restock",
  [`${OrderStatus.PROCESSING}->${OrderStatus.REFUNDED}`]: "restock",
  [`${OrderStatus.SHIPPED}->${OrderStatus.REFUNDED}`]: "none",
  [`${OrderStatus.DELIVERED}->${OrderStatus.REFUNDED}`]: "none",
};

/** Estados desde los que existe una arista hacia `refunded` — derivado de
 * `ORDER_TRANSITIONS`, nunca una lista aparte a mano: `order-refund.service.ts`
 * (qué puede pedirse) y `order-refund-settlement.service.ts` (qué puede
 * transicionar al confirmar) la usan como la MISMA fuente, así que no
 * pueden desincronizarse (hallazgo de code review de 1.6.3). */
const REFUNDABLE_ORDER_STATUSES: readonly OrderStatus[] = ALL_ORDER_STATUSES.filter((status) =>
  ORDER_TRANSITIONS[status].includes(OrderStatus.REFUNDED),
);

/** `canTransition(x, x)` es siempre `false` — re-aplicar el estado actual
 * no es una transición. Los callers que necesitan idempotencia (webhooks
 * duplicados) comparan `status === target` y salen temprano ANTES de
 * llamar aquí, en vez de que esto se los trague en silencio. */
function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/**
 * Único punto de entrada para validar una transición. Lanza 409 tanto si la
 * transición no existe en la tabla como si el actor no está autorizado para
 * dispararla — el caller (controller/service) nunca decide eso con un `if`
 * suelto.
 */
function assertTransition(from: OrderStatus, to: OrderStatus, actor: OrderActor): void {
  if (!canTransition(from, to)) {
    throw new AppError(`Transición de estado no permitida: ${from} -> ${to}.`, 409);
  }
  const allowedActors = TRANSITION_ACTORS[`${from}->${to}`] ?? [];
  if (!allowedActors.includes(actor)) {
    throw new AppError(`No tienes permiso para mover el pedido de ${from} a ${to}.`, 409);
  }
}

function getTransitionInventoryEffect(from: OrderStatus, to: OrderStatus): InventoryEffect {
  return TRANSITION_INVENTORY_EFFECT[`${from}->${to}`] ?? "none";
}

export {
  ALL_ORDER_STATUSES,
  ORDER_TRANSITIONS,
  REFUNDABLE_ORDER_STATUSES,
  canTransition,
  assertTransition,
  getTransitionInventoryEffect,
};
export type { OrderActor, InventoryEffect };
