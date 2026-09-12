import { describe, expect, it, vi } from "vitest";
import { createResendMailProvider } from "../../src/services/resend-mail-provider.js";
import type { ResendClientLike } from "../../src/services/resend-mail-provider.js";

/**
 * `createResendMailProvider` — mismo patrón que `stripe-payment-provider.ts`:
 * recibe el cliente por parámetro, así se testea sin llave real de Resend
 * (§8 del plan de 1.6.3). Envío best-effort: NUNCA lanza, un correo caído
 * no debe tumbar el flujo de negocio que lo disparó.
 */
function buildFakeClient(sendImpl: ResendClientLike["emails"]["send"]): ResendClientLike {
  return { emails: { send: sendImpl } };
}

describe("services/resend-mail-provider", () => {
  it("envía con from/to/subject/html y la idempotencyKey como opción", async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: "email_1" }, error: null });
    const provider = createResendMailProvider(buildFakeClient(send), "onboarding@resend.dev");

    const result = await provider.send({
      to: "ana@example.com",
      subject: "Confirma tu correo",
      html: "<p>hola</p>",
      idempotencyKey: "order-1-paid",
    });

    expect(result.sent).toBe(true);
    const [payload, options] = send.mock.calls[0]!;
    expect(payload).toEqual({ from: "onboarding@resend.dev", to: "ana@example.com", subject: "Confirma tu correo", html: "<p>hola</p>" });
    expect(options).toEqual({ idempotencyKey: "order-1-paid" });
  });

  it("sin idempotencyKey, no manda opciones", async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: "email_2" }, error: null });
    const provider = createResendMailProvider(buildFakeClient(send), "onboarding@resend.dev");

    await provider.send({ to: "ana@example.com", subject: "s", html: "<p>h</p>" });

    const [, options] = send.mock.calls[0]!;
    expect(options).toBeUndefined();
  });

  it("Resend responde con error (sin lanzar) -> sent:false", async () => {
    const send = vi.fn().mockResolvedValue({ data: null, error: { name: "validation_error", message: "invalid to" } });
    const provider = createResendMailProvider(buildFakeClient(send), "onboarding@resend.dev");

    const result = await provider.send({ to: "bad", subject: "s", html: "<p>h</p>" });

    expect(result.sent).toBe(false);
  });

  it("Resend lanza (red caída) -> nunca propaga, sent:false", async () => {
    const send = vi.fn().mockRejectedValue(new Error("network down"));
    const provider = createResendMailProvider(buildFakeClient(send), "onboarding@resend.dev");

    await expect(
      provider.send({ to: "ana@example.com", subject: "s", html: "<p>h</p>" }),
    ).resolves.toEqual({ sent: false });
  });
});
