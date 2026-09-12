import { EMAIL_BRAND_NAME, EMAIL_COLORS, EMAIL_LOGO_DATA_URI } from "./email-brand.js";

/**
 * Shell HTML compartido de todo correo transaccional
 * (ECOMMERCE_ARCHITECTURE_GUIDELINES.md §"Cómo se ve — correo", §8 del plan
 * de 1.6.3): reglas que un cliente de correo real impone y que un
 * navegador no. `paragraphs`/`title`/`preheader`/`disclaimer` ya deben
 * venir escapados por el caller (`order-email.service.ts`,
 * `email.service.ts`) — este archivo compone HTML, no decide qué es seguro
 * interpolar.
 */
interface EmailButton {
  label: string;
  url: string;
}

interface RenderTransactionalEmailInput {
  /** Texto oculto de 1px, ANTES que cualquier otro contenido — evita que la
   * vista previa de la bandeja muestre lo primero que encuentre (ver
   * "Truco del preheader" en el estándar). */
  preheader: string;
  title: string;
  /** Cada string es un párrafo (ya HTML seguro — nunca texto de un cliente
   * sin escapar, salvo que el caller ya lo haya pasado por `escapeHtml`). */
  paragraphs: string[];
  disclaimer: string;
  button?: EmailButton;
}

/** Botón "a prueba de balas": una `<table>` con una sola `<td>` con
 * `padding`/`background-color` envolviendo el `<a>`, en vez de esos
 * estilos en el `<a>` mismo — Outlook desktop (motor de Word) ignora
 * `padding`/`border-radius` en un `<a>` pero sí los respeta en una `<td>`. */
function renderButton(button: EmailButton): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td style="border-radius:6px;background-color:${EMAIL_COLORS.accent};" align="center">
          <a href="${button.url}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:${EMAIL_COLORS.accentText};text-decoration:none;">
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
  return `<span style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:${EMAIL_COLORS.accent};">${EMAIL_BRAND_NAME}</span>`;
}

function renderTransactionalEmail(input: RenderTransactionalEmailInput): string {
  const paragraphsHtml = input.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:${EMAIL_COLORS.text};">${paragraph}</p>`,
    )
    .join("\n");

  return `<!-- preheader -->
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
  ${input.preheader}
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_COLORS.background};padding:32px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="background-color:${EMAIL_COLORS.cardBackground};border:1px solid ${EMAIL_COLORS.border};border-radius:8px;">
        <tr>
          <td style="padding:24px 32px 0;">
            ${renderHeader()}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px;">
            <h1 style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:20px;color:${EMAIL_COLORS.text};">${input.title}</h1>
            ${paragraphsHtml}
            ${input.button ? renderButton(input.button) : ""}
            <p style="margin:24px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${EMAIL_COLORS.muted};">${input.disclaimer}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

export { renderTransactionalEmail };
export type { RenderTransactionalEmailInput, EmailButton };
