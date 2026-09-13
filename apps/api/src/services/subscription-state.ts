import { SubscriptionStatus } from "@esencia-glow/shared";
import { AppError } from "../utils/app-error.js";

/**
 * Máquina de estados de `SubscriptionAccount` — tabla como dato, pura y sin
 * I/O, calcada de order-state.ts. Ningún código escribe `status` directo:
 * toda transición pasa por `assertTransition`.
 *
 * `CANCELED -> INCOMPLETE` (re-alta) reusa el MISMO documento en vez de
 * crear uno nuevo — es la razón por la que `SubscriptionAccount` tiene
 * índice único sobre `userId` sin condición de estado (ver el modelo).
 *
 * `ACTIVE -> CANCELED` solo la dispara `system`: la clienta nunca cancela
 * directo, solo marca `cancelAtPeriodEnd` (decisión 7 del plan de 1.7.1) —
 * quien mueve el estado al llegar el fin del período es el webhook.
 */

type SubscriptionActor = "customer" | "admin" | "system";
type SeatEffect = "hold" | "release" | "none";

const ALL_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  SubscriptionStatus.INCOMPLETE,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
  SubscriptionStatus.PAUSED,
  SubscriptionStatus.CANCELED,
];

const SUBSCRIPTION_TRANSITIONS: Readonly<Record<SubscriptionStatus, readonly SubscriptionStatus[]>> = {
  [SubscriptionStatus.INCOMPLETE]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED],
  [SubscriptionStatus.ACTIVE]: [SubscriptionStatus.PAST_DUE, SubscriptionStatus.PAUSED, SubscriptionStatus.CANCELED],
  [SubscriptionStatus.PAST_DUE]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED],
  [SubscriptionStatus.PAUSED]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED],
  [SubscriptionStatus.CANCELED]: [SubscriptionStatus.INCOMPLETE],
};

/**
 * Cualquier transición que depende de que Stripe confirme algo (primer
 * cobro, renovación, dunning agotado) es `system` — mismo criterio
 * "Stripe-first" que `order-state.ts` (`pending->paid` solo `system`).
 * Pausar/reanudar/cancelar-desde-pausa son autoservicio directo de 1.7.3
 * (customer/admin), sin esperar a Stripe. La re-alta tras cancelar es un
 * acto de la propia clienta al re-suscribirse.
 */
const TRANSITION_ACTORS: Readonly<Record<string, readonly SubscriptionActor[]>> = {
  [`${SubscriptionStatus.INCOMPLETE}->${SubscriptionStatus.ACTIVE}`]: ["system"],
  [`${SubscriptionStatus.INCOMPLETE}->${SubscriptionStatus.CANCELED}`]: ["system"],
  [`${SubscriptionStatus.ACTIVE}->${SubscriptionStatus.PAST_DUE}`]: ["system"],
  [`${SubscriptionStatus.ACTIVE}->${SubscriptionStatus.PAUSED}`]: ["customer", "admin"],
  [`${SubscriptionStatus.ACTIVE}->${SubscriptionStatus.CANCELED}`]: ["system"],
  [`${SubscriptionStatus.PAST_DUE}->${SubscriptionStatus.ACTIVE}`]: ["system"],
  [`${SubscriptionStatus.PAST_DUE}->${SubscriptionStatus.CANCELED}`]: ["system"],
  [`${SubscriptionStatus.PAUSED}->${SubscriptionStatus.ACTIVE}`]: ["customer", "admin"],
  [`${SubscriptionStatus.PAUSED}->${SubscriptionStatus.CANCELED}`]: ["customer", "admin"],
  [`${SubscriptionStatus.CANCELED}->${SubscriptionStatus.INCOMPLETE}`]: ["customer"],
};

/**
 * Estados que ocupan un lugar en `SubscriptionPlan.seatsTaken` (ver
 * subscription-seat.service.ts). `PAUSED` NO está: pausar libera el cupo
 * para que el plan pueda venderlo a otra clienta (decisión 9 del plan de
 * 1.7.1) — consecuencia asumida: reanudar vuelve a reclamar cupo con el
 * mismo `$expr` que un alta nueva, y puede dar 409 si el plan ya se llenó.
 */
const SEAT_HOLDING_STATUSES: readonly SubscriptionStatus[] = [
  SubscriptionStatus.INCOMPLETE,
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.PAST_DUE,
];

/** Estados con derechos de suscriptora. `PAST_DUE` sí (Stripe sigue
 * reintentando el cobro, dunning); `PAUSED` no — es la clienta quien decidió
 * no recibir caja este ciclo. */
const ENTITLED_STATUSES: readonly SubscriptionStatus[] = [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE];

/** `canTransition(x, x)` es siempre `false` — re-aplicar el estado actual no
 * es una transición (mismo criterio que order-state.ts). */
function canTransition(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  return SUBSCRIPTION_TRANSITIONS[from].includes(to);
}

/**
 * Único punto de entrada para validar una transición. Lanza 409 tanto si la
 * transición no existe en la tabla como si el actor no está autorizado para
 * dispararla.
 */
function assertTransition(from: SubscriptionStatus, to: SubscriptionStatus, actor: SubscriptionActor): void {
  if (!canTransition(from, to)) {
    throw new AppError(`Transición de estado no permitida: ${from} -> ${to}.`, 409);
  }
  const allowedActors = TRANSITION_ACTORS[`${from}->${to}`] ?? [];
  if (!allowedActors.includes(actor)) {
    throw new AppError(`No tienes permiso para mover la suscripción de ${from} a ${to}.`, 409);
  }
}

/** Derivado de `SEAT_HOLDING_STATUSES`, nunca una tabla aparte a mano —
 * mismo criterio que `REFUNDABLE_ORDER_STATUSES` en order-state.ts (dos
 * listas paralelas se desincronizan). */
function seatEffect(from: SubscriptionStatus, to: SubscriptionStatus): SeatEffect {
  const held = SEAT_HOLDING_STATUSES.includes(from);
  const holds = SEAT_HOLDING_STATUSES.includes(to);
  if (!held && holds) return "hold";
  if (held && !holds) return "release";
  return "none";
}

function isEntitled(status: SubscriptionStatus): boolean {
  return ENTITLED_STATUSES.includes(status);
}

export {
  ALL_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_TRANSITIONS,
  SEAT_HOLDING_STATUSES,
  ENTITLED_STATUSES,
  canTransition,
  assertTransition,
  seatEffect,
  isEntitled,
};
export type { SubscriptionActor, SeatEffect };
