import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { AppError } from "../../src/utils/app-error.js";
import { parseStripeWebhookEvent, translateStripeEvent } from "../../src/services/stripe-webhook-translator.js";

/**
 * `stripe-webhook-translator.ts` — verificación de firma con `Stripe.webhooks`
 * (estático, sin instanciar cliente ni tocar red) y mapeo a nuestro
 * vocabulario. Firmas reales vía `generateTestHeaderString` (§1 del plan de
 * 1.6.2): ningún test de este archivo abre conexión ni usa llaves reales.
 */
const SECRET = "whsec_test_secret_de_prueba";
const TOLERANCE_SECONDS = 300;

function buildPaymentIntentEvent(
  type: string,
  overrides: Partial<{ id: string; metadata: Record<string, string>; last_payment_error: { message: string } }> = {},
): string {
  return JSON.stringify({
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type,
    data: {
      object: {
        id: overrides.id ?? "pi_1",
        object: "payment_intent",
        metadata: overrides.metadata ?? {},
        ...(overrides.last_payment_error ? { last_payment_error: overrides.last_payment_error } : {}),
      },
    },
  });
}

function sign(payload: string, opts: { timestamp?: number; secret?: string } = {}): string {
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: opts.secret ?? SECRET,
    ...(opts.timestamp !== undefined ? { timestamp: opts.timestamp } : {}),
  });
}

describe("services/stripe-webhook-translator — parseStripeWebhookEvent", () => {
  it("firma válida: verifica y traduce el evento", () => {
    const payload = buildPaymentIntentEvent("payment_intent.succeeded", { id: "pi_ok" });
    const signature = sign(payload);

    const event = parseStripeWebhookEvent(Buffer.from(payload), signature, {
      secret: SECRET,
      toleranceSeconds: TOLERANCE_SECONDS,
    });

    expect(event.kind).toBe("payment.captured");
    expect((event as { intentId: string }).intentId).toBe("pi_ok");
  });

  it("secreto distinto -> 400", () => {
    const payload = buildPaymentIntentEvent("payment_intent.succeeded");
    const signature = sign(payload, { secret: "whsec_otro_secreto" });

    expect(() =>
      parseStripeWebhookEvent(Buffer.from(payload), signature, { secret: SECRET, toleranceSeconds: TOLERANCE_SECONDS }),
    ).toThrow(AppError);
  });

  it("timestamp de hace 6 minutos con tolerancia de 300s -> 400", () => {
    const payload = buildPaymentIntentEvent("payment_intent.succeeded");
    const sixMinutesAgo = Math.floor(Date.now() / 1000) - 6 * 60;
    const signature = sign(payload, { timestamp: sixMinutesAgo });

    expect(() =>
      parseStripeWebhookEvent(Buffer.from(payload), signature, { secret: SECRET, toleranceSeconds: TOLERANCE_SECONDS }),
    ).toThrow(AppError);
  });

  it("body alterado 1 byte después de firmar -> 400", () => {
    const payload = buildPaymentIntentEvent("payment_intent.succeeded", { id: "pi_ok" });
    const signature = sign(payload);
    const tampered = payload.replace("pi_ok", "pi_ok2");

    expect(() =>
      parseStripeWebhookEvent(Buffer.from(tampered), signature, { secret: SECRET, toleranceSeconds: TOLERANCE_SECONDS }),
    ).toThrow(AppError);
  });

  it("payment_intent.payment_failed -> kind payment.failed con orderIdHint y lastError", () => {
    const payload = buildPaymentIntentEvent("payment_intent.payment_failed", {
      id: "pi_failed",
      metadata: { orderId: "order-123" },
      last_payment_error: { message: "Tarjeta rechazada" },
    });
    const signature = sign(payload);

    const event = parseStripeWebhookEvent(Buffer.from(payload), signature, {
      secret: SECRET,
      toleranceSeconds: TOLERANCE_SECONDS,
    });

    expect(event).toEqual(
      expect.objectContaining({
        kind: "payment.failed",
        intentId: "pi_failed",
        orderIdHint: "order-123",
        lastError: "Tarjeta rechazada",
      }),
    );
  });

  it("payment_intent.canceled -> kind payment.canceled", () => {
    const payload = buildPaymentIntentEvent("payment_intent.canceled", { id: "pi_cancel" });
    const signature = sign(payload);

    const event = parseStripeWebhookEvent(Buffer.from(payload), signature, {
      secret: SECRET,
      toleranceSeconds: TOLERANCE_SECONDS,
    });

    expect(event).toEqual(expect.objectContaining({ kind: "payment.canceled", intentId: "pi_cancel" }));
  });

  it("charge.refunded (fuera de alcance hasta 1.6.3) -> ignored", () => {
    const payload = JSON.stringify({
      id: "evt_refund",
      object: "event",
      type: "charge.refunded",
      data: { object: { id: "ch_1", object: "charge" } },
    });
    const signature = sign(payload);

    const event = parseStripeWebhookEvent(Buffer.from(payload), signature, {
      secret: SECRET,
      toleranceSeconds: TOLERANCE_SECONDS,
    });

    expect(event.kind).toBe("ignored");
  });

  it("tipo de evento desconocido -> ignored", () => {
    const payload = JSON.stringify({
      id: "evt_unknown",
      object: "event",
      type: "customer.created",
      data: { object: { id: "cus_1", object: "customer" } },
    });
    const signature = sign(payload);

    const event = translateStripeEvent(JSON.parse(payload));
    expect(event.kind).toBe("ignored");

    const parsed = parseStripeWebhookEvent(Buffer.from(payload), signature, {
      secret: SECRET,
      toleranceSeconds: TOLERANCE_SECONDS,
    });
    expect(parsed.kind).toBe("ignored");
  });
});
