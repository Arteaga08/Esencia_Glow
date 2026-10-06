import { EMAIL_BRAND_NAME, EMAIL_COLORS as C, EMAIL_FONTS as F, EMAIL_LOGO_DATA_URI } from "./email-brand.js";
import {
  renderCoupon,
  renderFacts,
  renderGuide,
  renderOrder,
  renderStatusChip,
  type EmailCouponBlock,
  type EmailFact,
  type EmailGuideBlock,
  type EmailOrderBlock,
  type EmailStatus,
} from "./email-blocks.js";

/**
 * Shell HTML compartido de todo correo transaccional (Milestone 3.6,
 * propuesta A "Etiqueta de frasco"): hoja blanca sobre el lienzo rosado,
 * datos en recuadros con la voz mono del home y el botón rosa de la tienda.
 * Reglas que un cliente de correo real impone y que un navegador no
 * (ECOMMERCE_ARCHITECTURE_GUIDELINES.md §"Cómo se ve — correo"): solo
 * tablas, CSS en línea, botón en una `<td>`, preheader oculto, cuerpo de
 * 16px y `disclaimer` siempre.
 *
 * `title`/`paragraphs`/`preheader`/`disclaimer`/`button.url` ya deben venir
 * escapados por el caller; los bloques opcionales (`status`, `facts`,
 * `order`, `guide`, `coupon`) son texto plano y se escapan en
 * `email-blocks.ts`.
 */
interface EmailButton {
  label: string;
  url: string;
}

interface RenderTransactionalEmailInput {
  /** Texto oculto de 1px, ANTES que cualquier otro contenido — evita que la
   * vista previa de la bandeja muestre lo primero que encuentre. */
  preheader: string;
  title: string;
  /** Cada string es un párrafo (ya HTML seguro). */
  paragraphs: string[];
  disclaimer: string;
  button?: EmailButton;
  status?: EmailStatus;
  facts?: EmailFact[];
  guide?: EmailGuideBlock;
  coupon?: EmailCouponBlock;
  order?: EmailOrderBlock;
}

/** Botón "a prueba de balas": fondo, borde y radio en la `<td>`; el `<a>` solo
 * lleva texto y relleno (Outlook/Word ignora el radio en un `<a>`). */
function renderButton(button: EmailButton): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
      <tr>
        <td align="center" bgcolor="${C.rose}" style="background-color:${C.rose};border:1px solid ${C.roseAction};border-radius:6px;">
          <a href="${button.url}" style="display:block;padding:15px 28px;font-family:${F.mono};font-size:14px;line-height:1.2;letter-spacing:0.1em;text-transform:uppercase;color:${C.ink};text-decoration:none;">
            ${button.label}
          </a>
        </td>
      </tr>
    </table>`;
}

function renderHeader(): string {
  if (EMAIL_LOGO_DATA_URI) {
    return `<img src="${EMAIL_LOGO_DATA_URI}" alt="${EMAIL_BRAND_NAME}" style="height:32px;" />`;
  }
  return `<span style="font-family:${F.sans};font-size:20px;font-weight:600;color:${C.ink};">${EMAIL_BRAND_NAME} <span style="font-size:13px;color:${C.butterText};">&#10022;</span></span>`;
}

function renderTransactionalEmail(input: RenderTransactionalEmailInput): string {
  const paragraphsHtml = input.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-family:${F.sans};font-size:16px;line-height:1.6;color:${C.ink};">${paragraph}</p>`,
    )
    .join("\n");

  const blocks = [
    input.facts ? renderFacts(input.facts) : "",
    input.guide ? renderGuide(input.guide) : "",
    input.coupon ? renderCoupon(input.coupon) : "",
    input.order ? renderOrder(input.order) : "",
    input.button ? renderButton(input.button) : "",
  ].join("");

  return `<!-- preheader -->
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
  ${input.preheader}
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.canvas};">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${C.surface};border:1px solid ${C.border};border-radius:12px;">
        <tr>
          <td style="padding:28px 36px 0;">${renderHeader()}</td>
        </tr>
        ${input.status ? `<tr><td style="padding:28px 36px 0;">${renderStatusChip(input.status)}</td></tr>` : ""}
        <tr>
          <td style="padding:16px 36px 0;">
            <h1 style="margin:0 0 16px;font-family:${F.sans};font-size:28px;line-height:1.2;letter-spacing:-0.01em;font-weight:600;color:${C.ink};">${input.title}</h1>
            ${paragraphsHtml}
            ${blocks}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px 32px;font-family:${F.sans};font-size:13px;line-height:1.5;color:${C.muted};">${input.disclaimer}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

export { renderTransactionalEmail };
export type { RenderTransactionalEmailInput, EmailButton };
