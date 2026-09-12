import type { Resend } from "resend";
import { logger } from "../config/logger.js";
import type { MailProvider, SendEmailInput, SendEmailResult } from "./mail-provider.js";

/**
 * Único archivo (junto a `mail-provider.ts`) donde puede aparecer
 * vocabulario crudo de Resend. Interfaz estructural angosta del cliente
 * que este adapter necesita — mismo patrón que `StripeClientLike` en
 * `stripe-payment-provider.ts` — para testear sin llave real de Resend.
 */
interface ResendClientLike {
  emails: {
    send: Resend["emails"]["send"];
  };
}

/**
 * Envío best-effort: la API de Resend devuelve `{data, error}` en vez de
 * lanzar para fallos de negocio (destinatario inválido, etc.), y una caída
 * de red sí puede lanzar — ambos casos se traducen a `sent:false`, nunca
 * se propagan. Un correo caído no debe tumbar el flujo de negocio que lo
 * disparó (verificación de cuenta, confirmación de pago, reembolso).
 */
function createResendMailProvider(client: ResendClientLike, fromEmail: string): MailProvider {
  return {
    async send(input: SendEmailInput): Promise<SendEmailResult> {
      try {
        const response = await client.emails.send(
          { from: fromEmail, to: input.to, subject: input.subject, html: input.html },
          input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
        );
        if (response.error) {
          logger.error({ err: response.error }, "Resend rechazó el envío de un correo");
          return { sent: false };
        }
        return { sent: true };
      } catch (error) {
        logger.error({ err: error }, "Fallo al enviar correo vía Resend");
        return { sent: false };
      }
    },
  };
}

export { createResendMailProvider };
export type { ResendClientLike };
