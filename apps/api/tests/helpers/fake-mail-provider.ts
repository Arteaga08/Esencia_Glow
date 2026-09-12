import { vi } from "vitest";
import type { MailProvider, SendEmailInput } from "../../src/services/mail-provider.js";

/**
 * Proveedor de correo falso, determinista y sin red — inyectado por
 * defecto en TODA la suite (`tests/setup.ts`, mismo criterio que
 * `fake-payment-provider.ts`): sin esto, cualquier flujo que dispare un
 * correo (registro, checkout, reembolso) intentaría hablar con Resend.
 * `calls` expone lo enviado para que un test puntual verifique asunto/HTML
 * sin tener que espiar el módulo.
 */
interface FakeMailProvider extends MailProvider {
  calls: SendEmailInput[];
}

function buildFakeMailProvider(): FakeMailProvider {
  const calls: SendEmailInput[] = [];
  return {
    calls,
    send: vi.fn().mockImplementation(async (input: SendEmailInput) => {
      calls.push(input);
      return { sent: true };
    }),
  };
}

export { buildFakeMailProvider };
export type { FakeMailProvider };
