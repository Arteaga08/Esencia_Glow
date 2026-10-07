import { sendEmail, type SendEmailResult } from "./mail-provider.js";
import { renderTransactionalEmail } from "./email-layout.js";
import { escapeHtml } from "../utils/escape-html.js";

/**
 * Correo de cupón personal (Milestone 3.6, conectado en 3.7 por
 * `coupon-grant.service.ts`, "dar cupón" desde Clientes).
 *
 * `message` es el único texto de todo el catálogo de correos que escribe una
 * persona (el admin): se pasa tal cual al bloque de cupón, que lo escapa. El
 * nombre también viene del usuario, así que se escapa aquí antes de entrar al
 * párrafo (HTML de confianza del shell).
 */
interface SendCouponEmailInput {
  to: string;
  name: string;
  code: string;
  /** Ya listo para mostrar, p. ej. "15% de descuento". */
  discountLabel: string;
  /** Texto de vigencia ya redactado, p. ej. "Vigente hasta el 31 de octubre de 2026". */
  expires?: string;
  message?: string;
  /** Destino del botón; omitido, el correo sale sin botón. */
  shopUrl?: string;
}

/** Best-effort como todo correo: nunca lanza (ver `sendEmail`). Devuelve el
 * resultado del envío para que "dar cupón" pueda decirle al admin si salió. */
async function sendCouponEmail(input: SendCouponEmailInput): Promise<SendEmailResult> {
  return sendEmail({
    to: input.to,
    subject: "Un detalle de Esencia Glow para ti",
    html: renderTransactionalEmail({
      preheader: "Tienes un cupón personal para tu próxima compra.",
      status: { label: "Para ti", tone: "rose" },
      title: "Un detalle para tu próxima compra",
      paragraphs: [`Hola ${escapeHtml(input.name)}, queremos agradecerte por estar con nosotras.`],
      coupon: {
        code: input.code,
        discountLabel: input.discountLabel,
        ...(input.expires ? { expires: input.expires } : {}),
        ...(input.message ? { message: input.message } : {}),
      },
      ...(input.shopUrl ? { button: { label: "Ir a la tienda", url: escapeHtml(input.shopUrl) } } : {}),
      disclaimer: "Este cupón es personal. Si no lo quieres, ignora este mensaje.",
    }),
  });
}

export { sendCouponEmail };
export type { SendCouponEmailInput };
