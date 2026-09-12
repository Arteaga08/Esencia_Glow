import { CATALOG_CURRENCY } from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { logger } from "../config/logger.js";
import { sendEmail } from "./mail-provider.js";
import { renderTransactionalEmail } from "./email-layout.js";
import { escapeHtml } from "../utils/escape-html.js";

/**
 * Correos del ciclo de vida del pedido (§8 del plan de 1.6.3): pago
 * recibido, ficha OXXO y reembolso. Cada uno carga SOLO lo que su copy
 * necesita — nunca el objeto completo de la orden o el usuario (ver
 * ECOMMERCE_ARCHITECTURE_GUIDELINES.md §"Catálogo de correos
 * transaccionales"). Todos best-effort: un fallo aquí nunca revierte la
 * transición que lo disparó.
 */

const MONEY_FORMATTER = new Intl.NumberFormat("es-MX", { style: "currency", currency: CATALOG_CURRENCY });
const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

function formatCents(cents: number): string {
  return MONEY_FORMATTER.format(cents / 100);
}

interface OrderEmailTarget {
  to: string;
  /** Ya escapado — seguro para interpolar en HTML. */
  name: string;
  orderNumber: string;
}

/** Carga solo lo que TODO correo de pedido necesita: el folio (de la
 * orden) y el destinatario (de su dueño). `shippingAddress.fullName` es el
 * nombre visible en el correo — lo escribe la clienta al hacer checkout,
 * así que se escapa aquí, una sola vez, antes de que cualquier plantilla
 * lo use. */
async function loadOrderEmailTarget(orderId: string): Promise<OrderEmailTarget | undefined> {
  const order = await Order.findById(orderId).select("orderNumber userId shippingAddress.fullName").lean();
  if (!order) return undefined;
  const user = await User.findById(order.userId).select("email").lean();
  if (!user) return undefined;
  return { to: user.email, name: escapeHtml(order.shippingAddress.fullName), orderNumber: order.orderNumber };
}

/** Envuelve el envío: nunca lanza (orden/usuario faltante, o el proveedor
 * caído) — un correo es siempre secundario al efecto de negocio que lo
 * disparó. */
async function sendOrderEmail(
  orderId: string,
  build: (target: OrderEmailTarget) => { subject: string; html: string; idempotencyKey: string },
): Promise<void> {
  try {
    const target = await loadOrderEmailTarget(orderId);
    if (!target) return;
    const { subject, html, idempotencyKey } = build(target);
    await sendEmail({ to: target.to, subject, html, idempotencyKey });
  } catch (error) {
    logger.error({ err: error, orderId }, "Fallo al enviar un correo de pedido");
  }
}

/** Dispara en `payment-settlement.service.ts` cuando `settleCapturedPayment`
 * transiciona de verdad a `paid` — cubre webhook, reconciliador y el
 * `already_captured` de `closePendingOrder`; un replay (`already_paid`) NO
 * reenvía (la idempotency key de Resend igual lo protegería, pero el
 * caller ya filtra antes de llamar). */
async function sendPaymentReceivedEmail(orderId: string): Promise<void> {
  await sendOrderEmail(orderId, (target) => ({
    subject: `Recibimos tu pago — Esencia Glow (${target.orderNumber})`,
    idempotencyKey: `order-${orderId}-paid`,
    html: renderTransactionalEmail({
      preheader: `Confirmamos tu pago del pedido ${target.orderNumber}.`,
      title: "¡Gracias por tu compra!",
      paragraphs: [
        `Hola ${target.name}, confirmamos el pago de tu pedido <strong>${target.orderNumber}</strong>.`,
        "Te avisaremos por aquí cuando salga hacia ti.",
      ],
      disclaimer: "Si tú no reconoces esta compra, contáctanos de inmediato.",
    }),
  }));
}

/** Dispara en `order-payment-intent.service.ts` — SOLO la llamada que gana
 * el claim de `persistPaymentIntent` para OXXO envía (evita un duplicado
 * si dos requests concurrentes llaman a `ensurePaymentIntent`). */
async function sendOxxoVoucherEmail(orderId: string, voucher: { hostedVoucherUrl: string; expiresAt: Date }): Promise<void> {
  await sendOrderEmail(orderId, (target) => ({
    subject: `Tu ficha OXXO — Esencia Glow (${target.orderNumber})`,
    idempotencyKey: `order-${orderId}-oxxo-voucher`,
    html: renderTransactionalEmail({
      preheader: `Paga tu pedido ${target.orderNumber} en cualquier OXXO.`,
      title: "Tu ficha de pago está lista",
      paragraphs: [
        `Hola ${target.name}, para completar tu pedido <strong>${target.orderNumber}</strong> paga tu ficha en cualquier tienda OXXO.`,
        `Vence el ${escapeHtml(DATE_FORMATTER.format(voucher.expiresAt))}.`,
      ],
      button: { label: "Ver mi ficha OXXO", url: voucher.hostedVoucherUrl },
      disclaimer: "Si tú no hiciste esta compra, ignora este mensaje.",
    }),
  }));
}

/** Dispara en `order-refund-settlement.service.ts` SOLO cuando el
 * reembolso fue TOTAL (transicionó la orden a `refunded`) — un parcial
 * hecho desde el Dashboard de Stripe no envía correo (decisión 2 del plan
 * de 1.6.3). */
async function sendRefundEmail(orderId: string, amountCents: number): Promise<void> {
  await sendOrderEmail(orderId, (target) => ({
    subject: `Reembolso confirmado — Esencia Glow (${target.orderNumber})`,
    idempotencyKey: `order-${orderId}-refunded`,
    html: renderTransactionalEmail({
      preheader: `Reembolsamos tu pedido ${target.orderNumber}.`,
      title: "Tu reembolso está confirmado",
      paragraphs: [
        `Hola ${target.name}, confirmamos el reembolso de <strong>${escapeHtml(formatCents(amountCents))}</strong> de tu pedido <strong>${target.orderNumber}</strong>.`,
        "El monto puede tardar unos días en reflejarse, según tu banco.",
      ],
      disclaimer: "Si tienes dudas sobre este reembolso, contáctanos.",
    }),
  }));
}

export { sendPaymentReceivedEmail, sendOxxoVoucherEmail, sendRefundEmail };
