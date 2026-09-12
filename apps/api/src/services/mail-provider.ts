import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { Resend } from "resend";
import { createResendMailProvider } from "./resend-mail-provider.js";

/**
 * Interfaz angosta del proveedor de correo — mismo patrón que
 * `payment-provider.ts`/`media-provider.ts`/`shipping-provider.ts` (§8 del
 * plan de 1.6.3): `resolveMailProvider()` es el único condicional de
 * proveedor, y todo lo que sepa que existe "Resend" vive en
 * `resend-mail-provider.ts`.
 */
interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Reenvía a la `Idempotency-Key` del proveedor cuando lo soporta (Resend
   * sí). Opcional: no todo correo necesita dedupe explícito. */
  idempotencyKey?: string;
}

interface SendEmailResult {
  sent: boolean;
}

interface MailProvider {
  /** Envío best-effort: NUNCA lanza. Un proveedor caído no debe tumbar el
   * flujo de negocio que disparó el correo (verificación, pago, reembolso). */
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

/** Seam de pruebas — mismo criterio que `payment-provider.ts`: `"unset"`
 * distingue "nunca se llamó" de "se llamó con `undefined`". */
let testOverride: MailProvider | undefined | "unset" = "unset";

function __setMailProviderForTests(provider: MailProvider | undefined): void {
  if (!env.isTest) {
    throw new Error("__setMailProviderForTests solo puede usarse en NODE_ENV=test");
  }
  testOverride = provider;
}

let client: Resend | undefined;

/** Único condicional de proveedor de correo de todo el proyecto. */
function resolveMailProvider(): MailProvider | undefined {
  if (env.isTest && testOverride !== "unset") return testOverride;
  if (!env.resendApiKey) return undefined;
  client ??= new Resend(env.resendApiKey);
  return createResendMailProvider(client, env.resendFromEmail);
}

/**
 * Punto de entrada único para el resto del código (`email.service.ts`,
 * `order-email.service.ts`): resuelve el proveedor y absorbe el caso "sin
 * configurar" (dev sin `RESEND_API_KEY`) en un solo lugar, en vez de que
 * cada caller repita el `if (!provider)`. Igual que el proveedor mismo,
 * NUNCA lanza — un correo es siempre best-effort.
 */
async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const provider = resolveMailProvider();
  if (!provider) {
    logger.warn({ to: "[redacted]" }, "RESEND_API_KEY no configurada — correo no enviado");
    return { sent: false };
  }
  return provider.send(input);
}

export { resolveMailProvider, sendEmail, __setMailProviderForTests };
export type { MailProvider, SendEmailInput, SendEmailResult };
