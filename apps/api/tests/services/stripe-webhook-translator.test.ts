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

  function buildChargeEvent(
    type: string,
    overrides: Partial<{ payment_intent: string | null; amount_refunded: number; currency: string }> = {},
  ): string {
    return JSON.stringify({
      id: `evt_${Math.random().toString(36).slice(2)}`,
      object: "event",
      type,
      data: {
        object: {
          id: "ch_1",
          object: "charge",
          payment_intent: overrides.payment_intent === undefined ? "pi_refunded" : overrides.payment_intent,
          amount_refunded: overrides.amount_refunded ?? 50000,
          currency: overrides.currency ?? "mxn",
        },
      },
    });
  }

  function buildRefundEvent(
    type: string,
    overrides: Partial<{ payment_intent: string | null; status: string; metadata: Record<string, string> }> = {},
  ): string {
    return JSON.stringify({
      id: `evt_${Math.random().toString(36).slice(2)}`,
      object: "event",
      type,
      data: {
        object: {
          id: "re_1",
          object: "refund",
          payment_intent: overrides.payment_intent === undefined ? "pi_refund_failed" : overrides.payment_intent,
          status: overrides.status ?? "failed",
          metadata: overrides.metadata ?? {},
        },
      },
    });
  }

  function buildDisputeEvent(
    type: string,
    overrides: Partial<{ payment_intent: string | null; status: string }> = {},
  ): string {
    return JSON.stringify({
      id: `evt_${Math.random().toString(36).slice(2)}`,
      object: "event",
      type,
      data: {
        object: {
          id: "dp_1",
          object: "dispute",
          payment_intent: overrides.payment_intent === undefined ? "pi_disputed" : overrides.payment_intent,
          status: overrides.status ?? "needs_response",
        },
      },
    });
  }

  it("charge.refunded -> kind payment.refunded con el intent, amountRefundedCents y currency del cargo", () => {
    const payload = buildChargeEvent("charge.refunded", { amount_refunded: 75000, currency: "mxn" });
    const signature = sign(payload);

    const event = parseStripeWebhookEvent(Buffer.from(payload), signature, {
      secret: SECRET,
      toleranceSeconds: TOLERANCE_SECONDS,
    });

    expect(event).toEqual(
      expect.objectContaining({
        kind: "payment.refunded",
        intentId: "pi_refunded",
        amountRefundedCents: 75000,
        currency: "mxn",
      }),
    );
  });

  it("charge.refunded sin payment_intent (null) -> ignored", () => {
    const payload = buildChargeEvent("charge.refunded", { payment_intent: null });
    const signature = sign(payload);

    const event = parseStripeWebhookEvent(Buffer.from(payload), signature, {
      secret: SECRET,
      toleranceSeconds: TOLERANCE_SECONDS,
    });

    expect(event.kind).toBe("ignored");
  });

  it("charge.refund.updated con status failed -> kind refund.failed", () => {
    const payload = buildRefundEvent("charge.refund.updated", { status: "failed" });
    const signature = sign(payload);

    const event = parseStripeWebhookEvent(Buffer.from(payload), signature, {
      secret: SECRET,
      toleranceSeconds: TOLERANCE_SECONDS,
    });

    expect(event).toEqual(
      expect.objectContaining({ kind: "refund.failed", intentId: "pi_refund_failed", refundId: "re_1" }),
    );
  });

  it("charge.refund.updated trae metadata.refundRequestedAtMs -> lo expone como requestedAtMs (fencing en recordRefundFailure)", () => {
    const payload = buildRefundEvent("charge.refund.updated", { status: "failed", metadata: { refundRequestedAtMs: "1700000000000" } });
    const signature = sign(payload);

    const event = parseStripeWebhookEvent(Buffer.from(payload), signature, {
      secret: SECRET,
      toleranceSeconds: TOLERANCE_SECONDS,
    });

    expect(event).toEqual(expect.objectContaining({ kind: "refund.failed", requestedAtMs: 1700000000000 }));
  });

  it("charge.refund.updated SIN metadata.refundRequestedAtMs (reembolso hecho a mano en el Dashboard) -> sin requestedAtMs", () => {
    const payload = buildRefundEvent("charge.refund.updated", { status: "failed" });
    const signature = sign(payload);

    const event = parseStripeWebhookEvent(Buffer.from(payload), signature, {
      secret: SECRET,
      toleranceSeconds: TOLERANCE_SECONDS,
    });

    expect((event as { requestedAtMs?: number }).requestedAtMs).toBeUndefined();
  });

  it("charge.refund.updated con status canceled -> kind refund.failed", () => {
    const payload = buildRefundEvent("charge.refund.updated", { status: "canceled" });
    const signature = sign(payload);

    const event = parseStripeWebhookEvent(Buffer.from(payload), signature, {
      secret: SECRET,
      toleranceSeconds: TOLERANCE_SECONDS,
    });

    expect(event.kind).toBe("refund.failed");
  });

  it("charge.refund.updated con status succeeded (en curso, no fallo) -> ignored", () => {
    const payload = buildRefundEvent("charge.refund.updated", { status: "succeeded" });
    const signature = sign(payload);

    const event = parseStripeWebhookEvent(Buffer.from(payload), signature, {
      secret: SECRET,
      toleranceSeconds: TOLERANCE_SECONDS,
    });

    expect(event.kind).toBe("ignored");
  });

  it("charge.dispute.created con status needs_response -> kind dispute.opened", () => {
    const payload = buildDisputeEvent("charge.dispute.created", { status: "needs_response" });
    const signature = sign(payload);

    const event = parseStripeWebhookEvent(Buffer.from(payload), signature, {
      secret: SECRET,
      toleranceSeconds: TOLERANCE_SECONDS,
    });

    expect(event).toEqual(
      expect.objectContaining({ kind: "dispute.opened", intentId: "pi_disputed", disputeId: "dp_1" }),
    );
  });

  it.each(["under_review", "warning_needs_response", "warning_under_review"])(
    "charge.dispute.created/closed con status %s -> también dispute.opened",
    (status) => {
      const payload = buildDisputeEvent("charge.dispute.closed", { status });
      const signature = sign(payload);

      const event = parseStripeWebhookEvent(Buffer.from(payload), signature, {
        secret: SECRET,
        toleranceSeconds: TOLERANCE_SECONDS,
      });

      expect(event.kind).toBe("dispute.opened");
    },
  );

  it("charge.dispute.closed con status won -> kind dispute.closed con outcome won", () => {
    const payload = buildDisputeEvent("charge.dispute.closed", { status: "won" });
    const signature = sign(payload);

    const event = parseStripeWebhookEvent(Buffer.from(payload), signature, {
      secret: SECRET,
      toleranceSeconds: TOLERANCE_SECONDS,
    });

    expect(event).toEqual(
      expect.objectContaining({ kind: "dispute.closed", intentId: "pi_disputed", disputeId: "dp_1", outcome: "won" }),
    );
  });

  it("charge.dispute.closed con status lost -> outcome lost", () => {
    const payload = buildDisputeEvent("charge.dispute.closed", { status: "lost" });
    const signature = sign(payload);

    const event = parseStripeWebhookEvent(Buffer.from(payload), signature, {
      secret: SECRET,
      toleranceSeconds: TOLERANCE_SECONDS,
    });

    expect(event).toEqual(expect.objectContaining({ kind: "dispute.closed", outcome: "lost" }));
  });

  it.each(["warning_closed", "prevented", "charge_refunded"])("charge.dispute.closed con status %s -> outcome withdrawn", (status) => {
    const payload = buildDisputeEvent("charge.dispute.closed", { status });
    const signature = sign(payload);

    const event = parseStripeWebhookEvent(Buffer.from(payload), signature, {
      secret: SECRET,
      toleranceSeconds: TOLERANCE_SECONDS,
    });

    expect(event).toEqual(expect.objectContaining({ kind: "dispute.closed", outcome: "withdrawn" }));
  });

  it("dispute con status desconocido -> ignored", () => {
    const payload = buildDisputeEvent("charge.dispute.created", { status: "algo_nuevo_de_stripe" });
    const signature = sign(payload);

    const event = parseStripeWebhookEvent(Buffer.from(payload), signature, {
      secret: SECRET,
      toleranceSeconds: TOLERANCE_SECONDS,
    });

    expect(event.kind).toBe("ignored");
  });

  it("dispute sin payment_intent (null) -> ignored", () => {
    const payload = buildDisputeEvent("charge.dispute.created", { payment_intent: null });
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
