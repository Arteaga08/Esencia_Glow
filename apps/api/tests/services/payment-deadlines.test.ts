import { PaymentMethod } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { computeOrderExpiresAt, computeReservationExpiresAt } from "../../src/services/payment-deadlines.js";

/**
 * `computeOrderExpiresAt` decide cuándo el sistema le pregunta a Stripe si
 * cierra el pedido (§D del plan de 1.6): tarjeta usa el TTL de reserva de
 * siempre; OXXO usa el vencimiento de la ficha + la gracia de confirmación
 * (o, antes de conocer la ficha, una cota superior conservadora).
 * `computeReservationExpiresAt` siempre agrega el margen de seguridad, para
 * que el barrendero ciego de 1.4 actúe DESPUÉS del cierre Stripe-first.
 */
describe("services/payment-deadlines", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("tarjeta: order.expiresAt = now + reservationTtlMinutes", () => {
    const result = computeOrderExpiresAt({
      method: PaymentMethod.CARD,
      now,
      reservationTtlMinutes: 30,
      oxxoVoucherDays: 2,
      oxxoConfirmationGraceHours: 96,
    });
    expect(result.getTime()).toBe(now.getTime() + 30 * 60_000);
  });

  it("OXXO sin ficha conocida: cota superior = now + (días+1)*24h + gracia", () => {
    const result = computeOrderExpiresAt({
      method: PaymentMethod.OXXO,
      now,
      reservationTtlMinutes: 30,
      oxxoVoucherDays: 2,
      oxxoConfirmationGraceHours: 96,
    });
    const expectedMs = now.getTime() + (2 + 1) * 24 * 60 * 60_000 + 96 * 60 * 60_000;
    expect(result.getTime()).toBe(expectedMs);
  });

  it("OXXO con ficha conocida: voucherExpiresAt + gracia", () => {
    const voucherExpiresAt = new Date("2026-01-03T23:59:00.000Z");
    const result = computeOrderExpiresAt({
      method: PaymentMethod.OXXO,
      now,
      reservationTtlMinutes: 30,
      oxxoVoucherDays: 2,
      oxxoConfirmationGraceHours: 96,
      voucherExpiresAt,
    });
    expect(result.getTime()).toBe(voucherExpiresAt.getTime() + 96 * 60 * 60_000);
  });

  it("reservation.expiresAt = order.expiresAt + margen de seguridad, siempre mayor", () => {
    const orderExpiresAt = new Date(now.getTime() + 30 * 60_000);
    const result = computeReservationExpiresAt(orderExpiresAt);
    expect(result.getTime()).toBeGreaterThan(orderExpiresAt.getTime());
    expect(result.getTime()).toBe(orderExpiresAt.getTime() + 15 * 60_000);
  });
});
