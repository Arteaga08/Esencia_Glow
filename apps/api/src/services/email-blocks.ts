import { CATALOG_CURRENCY } from "@esencia-glow/shared";
import { escapeHtml } from "../utils/escape-html.js";
import { EMAIL_COLORS as C, EMAIL_FONTS as F } from "./email-brand.js";

/**
 * Bloques opcionales del shell de correo (Milestone 3.6): estatus, datos
 * clave, pedido, guía y cupón. A diferencia de `paragraphs`/`title` del
 * shell (HTML que el caller ya escapó), TODO lo que entra aquí es texto
 * plano y se escapa en este archivo, una sola vez: los nombres de producto
 * y el mensaje del cupón no son código de esta base. Solo tablas y CSS en
 * línea, como exige el estándar.
 */

type EmailTone = "rose" | "mint" | "butter";

interface EmailStatus {
  label: string;
  tone: EmailTone;
}

interface EmailFact {
  label: string;
  value: string;
}

interface EmailOrderLine {
  name: string;
  /** Presentación o variante (p. ej. "150 ml"). */
  detail?: string;
  quantity: number;
  /** Solo si el correo muestra precios (el de pago); en preparación/guía se omite. */
  totalCents?: number;
}

interface EmailOrderBlock {
  lines: EmailOrderLine[];
  /** Con `totalCents` se pinta el desglose de subtotal, envío y total. */
  totals?: { subtotalCents: number; shippingCents: number; totalCents: number };
}

interface EmailGuideBlock {
  carrier: string;
  trackingNumber: string;
  note?: string;
}

interface EmailCouponBlock {
  code: string;
  discountLabel: string;
  expires?: string;
  /** Único texto que puede venir de una persona (el admin): se escapa aquí. */
  message?: string;
}

const TONES: Record<EmailTone, { background: string; color: string }> = {
  rose: { background: C.roseSoft, color: C.ink },
  mint: { background: C.mint, color: C.mintText },
  butter: { background: C.butter, color: C.ink },
};

const LABEL = `font-family:${F.mono};font-size:12px;line-height:1.3;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted};`;
const VALUE = `font-family:${F.mono};font-size:14px;line-height:1.4;color:${C.ink};`;

const MONEY_FORMATTER = new Intl.NumberFormat("es-MX", { style: "currency", currency: CATALOG_CURRENCY });

function formatMoney(cents: number): string {
  return MONEY_FORMATTER.format(cents / 100);
}

function renderStatusChip(status: EmailStatus): string {
  const tone = TONES[status.tone];
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background-color:${tone.background};font-family:${F.mono};font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:${tone.color};">${escapeHtml(status.label)}</span>`;
}

/** Recuadro de etiqueta: borde fuerte y filas separadas por una línea de un píxel. */
function labelBox(rows: string[]): string {
  const body = rows
    .map(
      (row, index) =>
        `<tr><td style="padding:12px 16px;${index < rows.length - 1 ? `border-bottom:1px solid ${C.border};` : ""}">${row}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border:1px solid ${C.borderStrong};border-radius:8px;">${body}</table>`;
}

function pairRow(label: string, value: string, valueStyle: string = VALUE): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="${LABEL}">${escapeHtml(label)}</td><td align="right" style="${valueStyle}">${escapeHtml(value)}</td></tr></table>`;
}

function renderFacts(facts: EmailFact[]): string {
  return labelBox(facts.map((fact) => pairRow(fact.label, fact.value)));
}

function renderGuide(guide: EmailGuideBlock): string {
  const rows = [
    pairRow("Paquetería", guide.carrier),
    `<div style="${LABEL}">Número de guía</div><div style="padding-top:6px;font-family:${F.mono};font-size:22px;line-height:1.3;letter-spacing:0.06em;color:${C.ink};word-break:break-all;">${escapeHtml(guide.trackingNumber)}</div>`,
  ];
  if (guide.note) {
    rows.push(`<div style="font-family:${F.sans};font-size:13px;line-height:1.5;color:${C.muted};">${escapeHtml(guide.note)}</div>`);
  }
  return labelBox(rows);
}

function renderOrderLine(line: EmailOrderLine): string {
  const detail = line.detail
    ? `<br><span style="${LABEL}letter-spacing:0.06em;">${escapeHtml(line.detail)}</span>`
    : "";
  const price =
    line.totalCents !== undefined ? `<td align="right" valign="top" style="${VALUE}">${formatMoney(line.totalCents)}</td>` : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="28" valign="top" style="${VALUE}">${line.quantity}×</td><td valign="top" style="font-family:${F.sans};font-size:15px;line-height:1.4;color:${C.ink};">${escapeHtml(line.name)}${detail}</td>${price}</tr></table>`;
}

function renderOrder(order: EmailOrderBlock): string {
  const rows = [`<div style="${LABEL}">Tu pedido</div>`, ...order.lines.map(renderOrderLine)];
  if (order.totals) {
    rows.push(pairRow("Subtotal", formatMoney(order.totals.subtotalCents)) + pairRow("Envío", formatMoney(order.totals.shippingCents)));
    rows.push(pairRow("Total", formatMoney(order.totals.totalCents), `${VALUE}font-size:18px;`));
  }
  return labelBox(rows);
}

function renderCoupon(coupon: EmailCouponBlock): string {
  const expires = coupon.expires ? `<div style="${LABEL}color:${C.butterText};">${escapeHtml(coupon.expires)}</div>` : "";
  const message = coupon.message
    ? `<p style="margin:0 0 24px;font-family:${F.sans};font-size:16px;line-height:1.6;color:${C.ink};">${escapeHtml(coupon.message)}</p>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td align="center" bgcolor="${C.butter}" style="padding:24px 16px;background-color:${C.butter};border:2px dashed ${C.butterText};border-radius:8px;">
<div style="font-family:${F.sans};font-size:20px;line-height:1.25;font-weight:600;color:${C.ink};">${escapeHtml(coupon.discountLabel)}</div>
<div style="padding:12px 0;font-family:${F.mono};font-size:30px;line-height:1.2;letter-spacing:0.16em;color:${C.ink};">${escapeHtml(coupon.code)}</div>
${expires}</td></tr></table>${message}`;
}

export { renderStatusChip, renderFacts, renderGuide, renderOrder, renderCoupon, formatMoney };
export type { EmailStatus, EmailTone, EmailFact, EmailOrderLine, EmailOrderBlock, EmailGuideBlock, EmailCouponBlock };
