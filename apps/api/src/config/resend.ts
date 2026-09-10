import { Resend } from "resend";
import { env } from "./env.js";
import { logger } from "./logger.js";

/**
 * Cliente perezoso de Resend. En desarrollo, `RESEND_API_KEY` puede faltar
 * (env.ts no la exige fuera de producción) — este módulo no lanza al
 * importarse, solo cuando de verdad se intenta enviar sin configurar.
 */

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

interface SendEmailResult {
  sent: boolean;
}

let client: Resend | undefined;

function getClient(): Resend | undefined {
  if (!env.resendApiKey) return undefined;
  client ??= new Resend(env.resendApiKey);
  return client;
}

/**
 * Envío best-effort: nunca lanza. Un fallo de correo no debe revertir el
 * flujo de negocio que lo disparó (ver email.service.ts).
 */
async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = getClient();
  if (!resend) {
    logger.warn({ to: "[redacted]" }, "RESEND_API_KEY no configurada — correo no enviado");
    return { sent: false };
  }

  try {
    await resend.emails.send({
      from: env.resendFromEmail,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    return { sent: true };
  } catch (error) {
    logger.error({ err: error }, "Fallo al enviar correo vía Resend");
    return { sent: false };
  }
}

export { sendEmail };
