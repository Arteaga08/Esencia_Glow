import { PaymentMethod, RESERVATION_SAFETY_MARGIN_MINUTES } from "@esencia-glow/shared";

/**
 * Deadlines de un pedido pendiente de pago (ver plan de 1.6 §D). Módulo puro
 * — sin I/O, `now` siempre inyectado — para fijar la aritmética en tests
 * sin depender de Stripe ni de Mongo.
 *
 * `order.expiresAt` es cuándo el sistema (barrendero / reconciliador) le
 * PREGUNTA A STRIPE si debe cerrar el pedido. `reservation.expiresAt` es la
 * red de seguridad ciega del barrendero de 1.4: siempre debe vencer DESPUÉS
 * de `order.expiresAt`, para que el cierre "Stripe-first" tenga oportunidad
 * de actuar primero.
 */
const MS_PER_HOUR = 60 * 60_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

interface ComputeOrderExpiresAtInput {
  method: PaymentMethod;
  now: Date;
  reservationTtlMinutes: number;
  oxxoVoucherDays: number;
  oxxoConfirmationGraceHours: number;
  /** Presente solo si Stripe ya confirmó la ficha OXXO (el PI de OXXO se
   * confirma en el mismo request que lo crea — ver stripe-payment-provider —
   * así que en la práctica siempre está disponible para OXXO). */
  voucherExpiresAt?: Date;
}

function computeOrderExpiresAt(input: ComputeOrderExpiresAtInput): Date {
  if (input.method === PaymentMethod.CARD) {
    return new Date(input.now.getTime() + input.reservationTtlMinutes * 60_000);
  }

  const graceMs = input.oxxoConfirmationGraceHours * MS_PER_HOUR;

  if (input.voucherExpiresAt) {
    return new Date(input.voucherExpiresAt.getTime() + graceMs);
  }

  // Cota superior conservadora antes de conocer la ficha: la ficha vence a
  // lo más `oxxoVoucherDays` días después de hoy, redondeado hacia arriba un
  // día completo (Stripe fija la hora de corte del día de vencimiento, no
  // desde `now`), más la misma gracia.
  return new Date(input.now.getTime() + (input.oxxoVoucherDays + 1) * MS_PER_DAY + graceMs);
}

function computeReservationExpiresAt(orderExpiresAt: Date): Date {
  return new Date(orderExpiresAt.getTime() + RESERVATION_SAFETY_MARGIN_MINUTES * 60_000);
}

export { computeOrderExpiresAt, computeReservationExpiresAt };
export type { ComputeOrderExpiresAtInput };
