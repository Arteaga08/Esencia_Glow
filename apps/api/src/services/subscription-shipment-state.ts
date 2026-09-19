import { SubscriptionShipmentStatus } from "@esencia-glow/shared";
import { AppError } from "../utils/app-error.js";
import type { SubscriptionActor } from "./subscription-state.js";

/**
 * Máquina de estados del envío del ciclo (Milestone 1.7.2b) — tabla como
 * dato, pura y sin I/O, calcada de subscription-state.ts. Ningún código
 * escribe `status` directo: toda transición pasa por
 * `assertShipmentTransition`.
 *
 * El flujo solo AVANZA (`pending -> processing -> shipped -> delivered`) o
 * se corta (`-> canceled`). No hay retroceso `processing -> pending`: la
 * única razón para volver sería un error de captura, y el envío no lleva
 * nada que se pierda por cancelar y esperar al siguiente ciclo.
 *
 * `SubscriptionActor` se importa de la máquina de la cuenta, nunca se
 * redeclara: "admin" y "system" significan lo mismo en los dos módulos, y
 * dos definiciones paralelas del mismo vocabulario se desincronizan.
 */

const SHIPMENT_TRANSITIONS: Readonly<Record<SubscriptionShipmentStatus, readonly SubscriptionShipmentStatus[]>> = {
  [SubscriptionShipmentStatus.PENDING]: [SubscriptionShipmentStatus.PROCESSING, SubscriptionShipmentStatus.CANCELED],
  [SubscriptionShipmentStatus.PROCESSING]: [SubscriptionShipmentStatus.SHIPPED, SubscriptionShipmentStatus.CANCELED],
  [SubscriptionShipmentStatus.SHIPPED]: [SubscriptionShipmentStatus.DELIVERED],
  [SubscriptionShipmentStatus.DELIVERED]: [],
  [SubscriptionShipmentStatus.CANCELED]: [],
};

/**
 * Quién puede disparar cada arista. Hoy todas son de `admin` (el panel es el
 * único consumidor), y `system` queda declarado para 1.7.3: cancelar las
 * cajas pendientes de una suscripción que Stripe dio de baja a mitad del
 * ciclo es una decisión del webhook, no de una persona.
 */
const TRANSITION_ACTORS: Readonly<Record<string, readonly SubscriptionActor[]>> = {
  [`${SubscriptionShipmentStatus.PENDING}->${SubscriptionShipmentStatus.PROCESSING}`]: ["admin"],
  [`${SubscriptionShipmentStatus.PENDING}->${SubscriptionShipmentStatus.CANCELED}`]: ["admin", "system"],
  [`${SubscriptionShipmentStatus.PROCESSING}->${SubscriptionShipmentStatus.SHIPPED}`]: ["admin"],
  [`${SubscriptionShipmentStatus.PROCESSING}->${SubscriptionShipmentStatus.CANCELED}`]: ["admin", "system"],
  [`${SubscriptionShipmentStatus.SHIPPED}->${SubscriptionShipmentStatus.DELIVERED}`]: ["admin"],
};

/**
 * Estados en los que el inventario de la caja sigue APARTADO
 * (`Inventory.reserved`) y todavía no salió del almacén. El efecto sobre el
 * stock se deriva de este conjunto — nunca una segunda tabla a mano, mismo
 * criterio que `seatEffect` deriva de `SEAT_HOLDING_STATUSES`.
 */
const STOCK_HELD_STATUSES: readonly SubscriptionShipmentStatus[] = [
  SubscriptionShipmentStatus.PENDING,
  SubscriptionShipmentStatus.PROCESSING,
];

type ShipmentStockEffect = "commit" | "release" | "none";

/** `canShipmentTransition(x, x)` es siempre `false` — re-aplicar el estado
 * actual no es una transición (mismo criterio que las otras dos máquinas). */
function canShipmentTransition(
  from: SubscriptionShipmentStatus,
  to: SubscriptionShipmentStatus,
  actor: SubscriptionActor,
): boolean {
  if (!SHIPMENT_TRANSITIONS[from].includes(to)) return false;
  return (TRANSITION_ACTORS[`${from}->${to}`] ?? []).includes(actor);
}

/** Único punto de entrada para validar una transición. Lanza 409 tanto si la
 * transición no existe en la tabla como si el actor no está autorizado. */
function assertShipmentTransition(
  from: SubscriptionShipmentStatus,
  to: SubscriptionShipmentStatus,
  actor: SubscriptionActor,
): void {
  if (!SHIPMENT_TRANSITIONS[from].includes(to)) {
    throw new AppError(`Transición de envío no permitida: ${from} -> ${to}.`, 409);
  }
  if (!(TRANSITION_ACTORS[`${from}->${to}`] ?? []).includes(actor)) {
    throw new AppError(`No tienes permiso para mover el envío de ${from} a ${to}.`, 409);
  }
}

/**
 * Qué le pasa al inventario al cruzar esta arista:
 * - `commit`: la caja salió (`-> shipped`), el stock apartado se descuenta
 *   de verdad (`reserved -> onHand`, ambos bajan).
 * - `release`: la caja no se enviará (`-> canceled`), la reserva vuelve a
 *   estar disponible.
 * - `none`: el stock no se mueve (preparar, o entregar algo ya enviado).
 */
function shipmentStockEffect(from: SubscriptionShipmentStatus, to: SubscriptionShipmentStatus): ShipmentStockEffect {
  if (!STOCK_HELD_STATUSES.includes(from)) return "none";
  if (STOCK_HELD_STATUSES.includes(to)) return "none";
  return to === SubscriptionShipmentStatus.CANCELED ? "release" : "commit";
}

export {
  SHIPMENT_TRANSITIONS,
  STOCK_HELD_STATUSES,
  canShipmentTransition,
  assertShipmentTransition,
  shipmentStockEffect,
};
export type { ShipmentStockEffect };
