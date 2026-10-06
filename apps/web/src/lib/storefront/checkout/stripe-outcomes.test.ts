import { describe, expect, it } from "vitest";
import { mapStripeError, mapIntentStatus } from "./stripe-outcomes";

describe("mapStripeError", () => {
  it("un rechazo del banco se pega al formulario de tarjeta y deja reintentar", () => {
    const outcome = mapStripeError({ type: "card_error", code: "card_declined", message: "Tu tarjeta fue rechazada." });
    expect(outcome).toEqual({ status: "declined", message: "Tu tarjeta fue rechazada." });
  });

  it("sin mensaje de Stripe usa uno propio en español", () => {
    const outcome = mapStripeError({ type: "card_error" });
    expect(outcome.status).toBe("declined");
    expect("message" in outcome && outcome.message).toMatch(/banco/i);
  });

  it("datos incompletos del formulario son de validación, no rechazo", () => {
    expect(mapStripeError({ type: "validation_error", message: "Tu número de tarjeta está incompleto." })).toEqual({
      status: "invalid",
      message: "Tu número de tarjeta está incompleto.",
    });
  });

  it("un intent que ya no admite confirmación (ya pagado) manda a la confirmación", () => {
    expect(mapStripeError({ type: "invalid_request_error", code: "payment_intent_unexpected_state" }).status).toBe("already");
  });

  it("cualquier otra cosa es un error genérico reintentable", () => {
    expect(mapStripeError({ type: "api_connection_error" })).toMatchObject({ status: "error" });
    expect(mapStripeError({})).toMatchObject({ status: "error" });
  });
});

describe("mapIntentStatus", () => {
  it("succeeded y processing se dan por enviados: el webhook decide el pagado", () => {
    expect(mapIntentStatus("succeeded")).toBe("submitted");
    expect(mapIntentStatus("processing")).toBe("submitted");
  });

  it("requires_payment_method es un rechazo; lo demás, error", () => {
    expect(mapIntentStatus("requires_payment_method")).toBe("declined");
    expect(mapIntentStatus("canceled")).toBe("error");
    expect(mapIntentStatus("requires_action")).toBe("error");
  });
});
