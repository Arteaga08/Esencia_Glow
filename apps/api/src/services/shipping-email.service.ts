import { logger } from "../config/logger.js";
import { escapeHtml } from "../utils/escape-html.js";
import { sendEmail } from "./mail-provider.js";
import { renderTransactionalEmail } from "./email-layout.js";
import { resolveAdminAlertEmail } from "./subscription-email.service.js";

/**
 * Correos del módulo de envíos (Milestone 1.9). Mismo criterio que
 * `subscription-email.service.ts`: best-effort (nunca lanza — un proveedor de
 * correo caído no debe tumbar el flujo de guías), el destino es
 * `ADMIN_ALERT_EMAIL` (opcional incluso en producción: sin ella solo se
 * loguea) y todo texto que pueda venir de fuera se escapa. Reusa el mismo
 * seam de pruebas del remitente de alertas de admin.
 */

interface SendShippingLabelAlertInput {
  orderId: string;
  orderNumber: string;
  /** Cuándo se selló esta revisión — forma parte de la `Idempotency-Key`. NO se
   * usa el número de intentos: el reintento manual lo reinicia a 0, así que la
   * segunda revisión del mismo pedido repetiría la clave y Resend (que dedupe
   * 24 h) la descartaría en silencio. */
  alertedAt: Date;
  /** Por qué quedó en revisión. Puede traer texto del proveedor: se escapa. */
  reason: string;
}

/**
 * Una guía quedó en `needs_review`: o no se sabe si el proveedor cobró
 * (timeout a media compra), o se agotaron los reintentos, o falta
 * configuración. Nunca se recompra sola; el correo avisa para que el admin
 * confirme en el panel del proveedor y reintente a mano. No lleva la
 * dirección de la clienta: solo el número de pedido.
 */
async function sendShippingLabelAlertEmail(input: SendShippingLabelAlertInput): Promise<void> {
  const to = resolveAdminAlertEmail();
  if (!to) {
    logger.warn({ orderId: input.orderId }, "ADMIN_ALERT_EMAIL no configurada — alerta de guía no enviada");
    return;
  }

  try {
    await sendEmail({
      to,
      subject: `Guía de envío en revisión — pedido ${input.orderNumber} — Esencia Glow (admin)`,
      idempotencyKey: `label-review-${input.orderId}-${input.alertedAt.getTime()}`,
      html: renderTransactionalEmail({
        preheader: `La guía del pedido ${input.orderNumber} necesita revisión manual.`,
        title: "Una guía de envío necesita revisión",
        paragraphs: [
          `No se pudo generar de forma segura la guía del pedido <strong>${escapeHtml(input.orderNumber)}</strong>.`,
          `Motivo: ${escapeHtml(input.reason)}`,
          "Antes de reintentar, confirma en el panel del proveedor que NO exista ya una guía para este pedido — comprarla dos veces gasta créditos dos veces.",
        ],
        disclaimer: "Reintenta desde el detalle del pedido en el panel.",
      }),
    });
  } catch (error) {
    logger.error({ err: error, orderId: input.orderId }, "Fallo al enviar la alerta de guía de envío");
  }
}

export { sendShippingLabelAlertEmail };
export type { SendShippingLabelAlertInput };
