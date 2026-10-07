import { CATALOG_CURRENCY, SHIPPING_CARRIER_LABELS } from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { logger } from "../config/logger.js";
import { sendEmail } from "./mail-provider.js";
import { renderTransactionalEmail } from "./email-layout.js";
import type { EmailOrderLine } from "./email-blocks.js";
import { escapeHtml } from "../utils/escape-html.js";

/**
 * Correos del ciclo de vida del pedido (§8 del plan de 1.6.3, ampliado en
 * 3.6): pago recibido, ficha OXXO, reembolso, pedido en preparación y guía
 * de envío. Cada uno carga SOLO lo que su copy
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

interface OrderEmailShipment {
  carrierLabel: string;
  trackingNumber: string;
  /** Solo http(s): lo escribe un admin o el proveedor, nunca se interpola sin validar. */
  trackingUrl?: string;
}

interface OrderEmailTarget {
  to: string;
  /** Ya escapado — seguro para interpolar en HTML. */
  name: string;
  orderNumber: string;
  /** Texto plano (el bloque de pedido lo escapa); con precio de línea. */
  lines: EmailOrderLine[];
  totals: { subtotalCents: number; shippingCents: number; totalCents: number };
  shipment?: OrderEmailShipment;
}

const HTTP_URL_PATTERN = /^https?:\/\//i;

function describeVariant(line: {
  variantName?: string;
  attributes?: { size?: string; shade?: string; volume?: string };
}): string | undefined {
  if (line.variantName) return line.variantName;
  const parts = [line.attributes?.volume, line.attributes?.size, line.attributes?.shade].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** Líneas sin precio: preparación y guía no repiten el desglose de dinero. */
function withoutPrices(lines: EmailOrderLine[]): EmailOrderLine[] {
  return lines.map(({ totalCents: _totalCents, ...line }) => line);
}

/** Carga solo lo que los correos de pedido necesitan: folio, líneas, totales y
 * guía (de la orden) y el destinatario (de su dueño). `shippingAddress.fullName`
 * es el nombre visible en el correo — lo escribe la clienta al hacer checkout,
 * así que se escapa aquí, una sola vez, antes de que cualquier plantilla lo
 * use. Las líneas y la guía NO se escapan aquí: el bloque de pedido y el de
 * guía de `email-blocks.ts` lo hacen al renderizar. */
async function loadOrderEmailTarget(orderId: string): Promise<OrderEmailTarget | undefined> {
  const order = await Order.findById(orderId)
    .select("orderNumber userId shippingAddress.fullName lines subtotalCents shippingCents totalCents shipment")
    .lean();
  if (!order) return undefined;
  const user = await User.findById(order.userId).select("email").lean();
  if (!user) return undefined;

  const shipment = order.shipment;
  const trackingUrl = shipment?.trackingUrl;
  return {
    to: user.email,
    name: escapeHtml(order.shippingAddress.fullName),
    orderNumber: order.orderNumber,
    lines: order.lines.map((line) => ({
      name: line.name,
      ...(describeVariant(line) ? { detail: describeVariant(line) } : {}),
      quantity: line.quantity,
      totalCents: line.lineTotalCents,
    })),
    totals: { subtotalCents: order.subtotalCents, shippingCents: order.shippingCents, totalCents: order.totalCents },
    ...(shipment
      ? {
          shipment: {
            carrierLabel: shipment.carrierName ?? SHIPPING_CARRIER_LABELS[shipment.carrier],
            trackingNumber: shipment.trackingNumber,
            ...(trackingUrl && HTTP_URL_PATTERN.test(trackingUrl) ? { trackingUrl: escapeHtml(trackingUrl) } : {}),
          },
        }
      : {}),
  };
}

/** Envuelve el envío: nunca lanza (orden/usuario faltante, o el proveedor
 * caído) — un correo es siempre secundario al efecto de negocio que lo
 * disparó. */
async function sendOrderEmail(
  orderId: string,
  build: (target: OrderEmailTarget) => { subject: string; html: string; idempotencyKey: string } | undefined,
): Promise<void> {
  try {
    const target = await loadOrderEmailTarget(orderId);
    if (!target) return;
    const built = build(target);
    if (!built) return;
    const { subject, html, idempotencyKey } = built;
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
    subject: `Recibimos tu pago, pedido ${target.orderNumber}`,
    idempotencyKey: `order-${orderId}-paid`,
    html: renderTransactionalEmail({
      preheader: `Confirmamos el pago de tu pedido ${target.orderNumber}.`,
      status: { label: "Pago recibido", tone: "mint" },
      title: "Gracias por tu compra",
      paragraphs: [
        `Hola ${target.name}, ya tenemos tu pago y empezamos a organizar tu pedido.`,
        "Te escribimos de nuevo cuando esté en preparación y cuando salga hacia ti.",
      ],
      facts: [{ label: "Folio", value: target.orderNumber }],
      order: { lines: target.lines, totals: target.totals },
      disclaimer: "Si no reconoces esta compra, escríbenos de inmediato con tu folio a la mano.",
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

/** Dispara cuando el pedido entra a `processing` (`order-status-email.ts`):
 * la dueña lo movió a mano desde el panel (o el rastreo ya iba adelante). */
async function sendOrderProcessingEmail(orderId: string): Promise<void> {
  await sendOrderEmail(orderId, (target) => ({
    subject: `Estamos preparando tu pedido ${target.orderNumber}`,
    idempotencyKey: `order-${orderId}-processing`,
    html: renderTransactionalEmail({
      preheader: "Tu pedido ya está en preparación.",
      status: { label: "En preparación", tone: "butter" },
      title: "Estamos preparando tu pedido",
      paragraphs: [
        `Hola ${target.name}, tu pedido ya está en manos de nuestro equipo.`,
        "Cuando salga hacia ti te enviamos el número de guía para que lo sigas.",
      ],
      facts: [{ label: "Folio", value: target.orderNumber }],
      order: { lines: withoutPrices(target.lines) },
      disclaimer: "Si tienes dudas sobre tu pedido, escríbenos con tu folio a la mano.",
    }),
  }));
}

/** Dispara en la transición `processing -> shipped` (sistema o admin). Una
 * corrección posterior de la guía NO reenvía: la idempotency key es la misma
 * y `updateOrderShipment` no llama a este correo. Sin guía guardada no hay
 * nada que avisar, así que no envía. */
async function sendShipmentNotificationEmail(orderId: string): Promise<void> {
  await sendOrderEmail(orderId, (target) => {
    if (!target.shipment) return undefined;
    const { carrierLabel, trackingNumber, trackingUrl } = target.shipment;
    return {
      subject: `Tu pedido ${target.orderNumber} va en camino`,
      idempotencyKey: `order-${orderId}-shipped`,
      html: renderTransactionalEmail({
        preheader: "Ya tienes número de guía para seguir tu envío.",
        status: { label: "Enviado", tone: "rose" },
        title: "Tu pedido va en camino",
        paragraphs: [
          `Hola ${target.name}, entregamos tu pedido a la paquetería.`,
          "Con este número de guía puedes seguirlo hasta tu puerta.",
        ],
        facts: [{ label: "Folio", value: target.orderNumber }],
        guide: {
          carrier: carrierLabel,
          trackingNumber,
          note: "El rastreo puede tardar unas horas en mostrar el primer movimiento.",
        },
        order: { lines: withoutPrices(target.lines) },
        ...(trackingUrl ? { button: { label: "Rastrear mi envío", url: trackingUrl } } : {}),
        disclaimer: "Si no reconoces este envío, escríbenos de inmediato con tu folio a la mano.",
      }),
    };
  });
}

export {
  sendPaymentReceivedEmail,
  sendOxxoVoucherEmail,
  sendRefundEmail,
  sendOrderProcessingEmail,
  sendShipmentNotificationEmail,
};
