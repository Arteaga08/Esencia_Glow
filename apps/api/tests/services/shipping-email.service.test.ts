import { afterEach, describe, expect, it } from "vitest";
import { __setAdminAlertEmailForTests } from "../../src/services/subscription-email.service.js";
import { sendShippingLabelAlertEmail } from "../../src/services/shipping-email.service.js";
import { __setMailProviderForTests } from "../../src/services/mail-provider.js";
import { buildFakeMailProvider } from "../helpers/fake-mail-provider.js";

/**
 * Alerta al admin cuando una guía de envío queda en revisión (1.9). Mismo
 * criterio que las alertas de suscripción: best-effort (nunca lanza), destino
 * en `ADMIN_ALERT_EMAIL` (opcional: sin ella solo se loguea), texto escapado.
 */
describe("services/shipping-email — sendShippingLabelAlertEmail", () => {
  afterEach(() => {
    __setAdminAlertEmailForTests(undefined);
  });

  const alertedAt = new Date("2026-09-21T16:00:00Z");
  const input = { orderId: "64b7f0c2a1b2c3d4e5f60718", orderNumber: "EG-1001", alertedAt, reason: "Timeout del proveedor" };

  it("envía al ADMIN_ALERT_EMAIL con asunto, número de pedido y motivo, e Idempotency-Key por episodio de revisión", async () => {
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);
    __setAdminAlertEmailForTests("ops@esenciaglow.mx");

    await sendShippingLabelAlertEmail(input);

    expect(fake.calls).toHaveLength(1);
    const call = fake.calls[0]!;
    expect(call.to).toBe("ops@esenciaglow.mx");
    expect(call.subject).toContain("Guía de envío");
    expect(call.subject).toContain("revisión");
    expect(call.html).toContain("EG-1001");
    expect(call.html).toContain("Timeout del proveedor");
    expect(call.idempotencyKey).toBe(`label-review-${input.orderId}-${alertedAt.getTime()}`);
  });

  it("dos episodios de revisión del MISMO pedido (p. ej. tras un reintento manual) usan claves distintas: la segunda alerta no la dedupea Resend", async () => {
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);
    __setAdminAlertEmailForTests("ops@esenciaglow.mx");

    await sendShippingLabelAlertEmail(input);
    await sendShippingLabelAlertEmail({ ...input, alertedAt: new Date(alertedAt.getTime() + 3_600_000) });

    expect(new Set(fake.calls.map((c) => c.idempotencyKey)).size).toBe(2);
  });

  it("escapa el motivo (puede traer texto del proveedor)", async () => {
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);
    __setAdminAlertEmailForTests("ops@esenciaglow.mx");

    await sendShippingLabelAlertEmail({ ...input, reason: '<script>alert("x")</script>' });

    expect(fake.calls[0]!.html).not.toContain("<script>");
    expect(fake.calls[0]!.html).toContain("&lt;script&gt;");
  });

  it("sin ADMIN_ALERT_EMAIL no envía y no lanza", async () => {
    const fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);
    __setAdminAlertEmailForTests(undefined);

    await expect(sendShippingLabelAlertEmail(input)).resolves.toBeUndefined();
    expect(fake.calls).toHaveLength(0);
  });

  it("si el proveedor de correo revienta, no lanza (best-effort)", async () => {
    __setMailProviderForTests({
      send: async () => {
        throw new Error("Resend caído");
      },
    });
    __setAdminAlertEmailForTests("ops@esenciaglow.mx");

    await expect(sendShippingLabelAlertEmail(input)).resolves.toBeUndefined();
  });
});
