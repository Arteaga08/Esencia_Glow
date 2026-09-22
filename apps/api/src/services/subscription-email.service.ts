import type { Types } from "mongoose";
import { CATALOG_CURRENCY } from "@esencia-glow/shared";
import { env } from "../config/env.js";
import { User } from "../models/user.model.js";
import { logger } from "../config/logger.js";
import { sendEmail } from "./mail-provider.js";
import { renderTransactionalEmail } from "./email-layout.js";
import { escapeHtml } from "../utils/escape-html.js";

/**
 * Correos del webhook de Billing (Fase 5 de 1.7.2a, §7 del plan): confirmación
 * de cada cobro exitoso y dunning a la clienta, alerta al admin por edición o
 * inventario faltante en la caja de un ciclo. Mismo criterio que
 * `order-email.service.ts`: cada uno carga solo lo que su copy necesita,
 * nunca lanza (un correo es siempre secundario al efecto de negocio que lo
 * disparó) y lleva su propia `Idempotency-Key` hacia Resend.
 */

const MONEY_FORMATTER = new Intl.NumberFormat("es-MX", { style: "currency", currency: CATALOG_CURRENCY });
const DATE_FORMATTER = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "America/Mexico_City" });

function formatCents(cents: number): string {
  return MONEY_FORMATTER.format(cents / 100);
}

interface SubscriberEmailTarget {
  to: string;
  /** Ya escapado — seguro para interpolar en HTML. */
  name: string;
}

async function loadSubscriberEmailTarget(userId: Types.ObjectId | string): Promise<SubscriberEmailTarget | undefined> {
  const user = await User.findById(userId).select("email firstName lastName").lean();
  if (!user) return undefined;
  return { to: user.email, name: escapeHtml(`${user.firstName} ${user.lastName}`) };
}

/** Envuelve el envío a la suscriptora: nunca lanza (usuaria faltante, o el
 * proveedor caído). */
async function sendSubscriberEmail(
  userId: Types.ObjectId | string,
  build: (target: SubscriberEmailTarget) => { subject: string; html: string; idempotencyKey: string },
): Promise<void> {
  try {
    const target = await loadSubscriberEmailTarget(userId);
    if (!target) return;
    const { subject, html, idempotencyKey } = build(target);
    await sendEmail({ to: target.to, subject, html, idempotencyKey });
  } catch (error) {
    logger.error({ err: error, userId: userId.toString() }, "Fallo al enviar un correo de suscripción");
  }
}

interface SendPaymentConfirmedInput {
  accountId: string;
  userId: Types.ObjectId | string;
  invoiceRef: string;
  amountPaidCents: number;
  currency: string;
  periodEnd: Date;
}

/** Dispara en `subscription-webhook-handlers.ts::handleInvoicePaid` en CADA
 * cobro exitoso (alta y renovación son el mismo evento) — la
 * `Idempotency-Key` por `invoiceRef` es la única defensa contra un doble
 * envío si dos entregas de Stripe con `eventId` distinto llegan para la
 * misma factura (el dedupe de `PaymentEvent` solo cubre el `eventId`). */
async function sendSubscriptionPaymentConfirmedEmail(input: SendPaymentConfirmedInput): Promise<void> {
  await sendSubscriberEmail(input.userId, (target) => ({
    subject: "Confirmamos tu cobro — Esencia Glow",
    idempotencyKey: `subscription-${input.accountId}-invoice-${input.invoiceRef}`,
    html: renderTransactionalEmail({
      preheader: `Confirmamos el cobro de tu suscripción por ${formatCents(input.amountPaidCents)}.`,
      title: "¡Gracias por tu suscripción!",
      paragraphs: [
        `Hola ${target.name}, confirmamos el cobro de <strong>${escapeHtml(formatCents(input.amountPaidCents))}</strong> de tu suscripción.`,
        `Tu caja de este ciclo queda vigente hasta el ${escapeHtml(DATE_FORMATTER.format(input.periodEnd))}.`,
      ],
      disclaimer: "Si tú no reconoces este cobro, contáctanos de inmediato.",
    }),
  }));
}

interface SendDunningInput {
  accountId: string;
  userId: Types.ObjectId | string;
  invoiceRef: string;
  attemptCount: number;
}

/** Dispara en `subscription-webhook-handlers.ts::handlePaymentFailed`. La
 * `Idempotency-Key` incluye `attemptCount` (idempotente por construcción,
 * igual que `recordPaymentFailure`) para que cada intento fallido avise una
 * sola vez, sin represar un reintento nuevo. */
async function sendSubscriptionDunningEmail(input: SendDunningInput): Promise<void> {
  await sendSubscriberEmail(input.userId, (target) => ({
    subject: "No pudimos procesar tu pago — Esencia Glow",
    idempotencyKey: `subscription-${input.accountId}-dunning-${input.invoiceRef}-${input.attemptCount}`,
    html: renderTransactionalEmail({
      preheader: "No pudimos cobrar tu suscripción, verifica tu método de pago.",
      title: "Tuvimos un problema con tu pago",
      paragraphs: [
        `Hola ${target.name}, intentamos cobrar tu suscripción y no se pudo procesar.`,
        "Verifica que tu tarjeta tenga fondos y esté vigente — reintentaremos el cobro automáticamente en los próximos días.",
      ],
      disclaimer: "Si el problema continúa, tu suscripción podría pausarse por falta de pago.",
    }),
  }));
}

interface SendAdminIncidentInput {
  shipmentId: string;
  reason: "edition_missing" | "inventory_shortage" | "duplicate_cycle_invoice";
  cycleYear: number;
  cycleMonth: number;
}

/** Seam de pruebas para el remitente de alertas de admin — mismo patrón
 * `"unset"` que `mail-provider.ts`/`payment-provider.ts`: en test, sin
 * override explícito, cae al valor real de `env.adminAlertEmail`
 * (`ADMIN_ALERT_EMAIL`, ausente por defecto en la suite). */
let adminAlertEmailOverride: string | undefined | "unset" = "unset";

function __setAdminAlertEmailForTests(value: string | undefined): void {
  if (!env.isTest) {
    throw new Error("__setAdminAlertEmailForTests solo puede usarse en NODE_ENV=test");
  }
  adminAlertEmailOverride = value;
}

function resolveAdminAlertEmail(): string | undefined {
  if (env.isTest && adminAlertEmailOverride !== "unset") return adminAlertEmailOverride;
  return env.adminAlertEmail;
}

const INCIDENT_COPY: Record<SendAdminIncidentInput["reason"], { subject: string; paragraph: string }> = {
  edition_missing: {
    subject: "Falta la edición del ciclo — Esencia Glow (admin)",
    paragraph: "La caja se cobró y se creó, pero no hay una edición publicada para este ciclo.",
  },
  inventory_shortage: {
    subject: "Inventario insuficiente para una caja — Esencia Glow (admin)",
    paragraph: "La caja se cobró y se creó, pero no había inventario suficiente para reservar todos sus productos.",
  },
  duplicate_cycle_invoice: {
    subject: "Factura duplicada sobre un ciclo ya facturado — Esencia Glow (admin)",
    paragraph:
      "Llegó una factura DISTINTA de Stripe para un ciclo que ya tenía caja — revisa si la clienta fue cobrada dos veces.",
  },
};

/** Dispara en `subscription-shipment.service.ts::createCycleShipment` cuando
 * la caja del ciclo sale con `editionIncident`/`inventoryIncident`, o cuando
 * una factura distinta llega para un ciclo ya facturado (`duplicate_cycle_invoice`
 * — la anomalía MÁS seria de las tres, un posible doble cobro) — el cobro ya
 * ocurrió (decisión 3 del plan), este correo es el aviso para que el admin
 * resuelva a mano. Sin `ADMIN_ALERT_EMAIL` configurada, se degrada a
 * loguear (integración puramente operativa, opcional incluso en
 * producción — ver `config/env.ts`). */
async function sendSubscriptionAdminIncidentEmail(input: SendAdminIncidentInput): Promise<void> {
  const to = resolveAdminAlertEmail();
  if (!to) {
    logger.warn({ shipmentId: input.shipmentId, reason: input.reason }, "ADMIN_ALERT_EMAIL no configurada — alerta no enviada");
    return;
  }

  try {
    const copy = INCIDENT_COPY[input.reason];
    await sendEmail({
      to,
      subject: copy.subject,
      idempotencyKey: `subscription-shipment-${input.shipmentId}-incident`,
      html: renderTransactionalEmail({
        preheader: copy.paragraph,
        title: "Incidencia en una caja de suscripción",
        paragraphs: [
          copy.paragraph,
          `Ciclo ${String(input.cycleMonth).padStart(2, "0")}/${input.cycleYear} — caja <code>${escapeHtml(input.shipmentId)}</code>.`,
        ],
        disclaimer: "Revísalo en el panel de envíos de suscripción.",
      }),
    });
  } catch (error) {
    logger.error({ err: error, shipmentId: input.shipmentId }, "Fallo al enviar la alerta de admin de una caja de suscripción");
  }
}

interface SendUpcomingEditionMissingInput {
  planId: string;
  planName: string;
  cycleYear: number;
  cycleMonth: number;
}

/**
 * Aviso PREVENTIVO (Milestone 1.7.2b): se acerca el cobro anclado y el ciclo
 * todavía no tiene edición publicada. Función hermana de
 * `sendSubscriptionAdminIncidentEmail` en vez de una cuarta `reason` de
 * aquélla, porque aquélla se identifica por `shipmentId` y aquí todavía no
 * existe ninguna caja — el punto entero de este correo es que llega antes.
 *
 * Idempotencia por ciclo: la `Idempotency-Key` lleva plan + ciclo, y el job
 * además sella `SubscriptionPlan.missingEditionAlertedFor` para no reintentar
 * cada minuto.
 */
async function sendUpcomingEditionMissingEmail(input: SendUpcomingEditionMissingInput): Promise<void> {
  const to = resolveAdminAlertEmail();
  if (!to) {
    logger.warn({ planId: input.planId }, "ADMIN_ALERT_EMAIL no configurada — aviso preventivo no enviado");
    return;
  }

  const cycle = `${String(input.cycleMonth).padStart(2, "0")}/${input.cycleYear}`;
  try {
    await sendEmail({
      to,
      subject: `Falta publicar la edición de ${cycle} — Esencia Glow (admin)`,
      idempotencyKey: `subscription-plan-${input.planId}-edition-missing-${input.cycleYear}-${input.cycleMonth}`,
      html: renderTransactionalEmail({
        preheader: `El cobro del ciclo ${cycle} se acerca y el plan todavía no tiene edición publicada.`,
        title: "Falta publicar la edición del próximo ciclo",
        paragraphs: [
          `El plan <strong>${escapeHtml(input.planName)}</strong> tiene suscriptoras activas y el cobro del ciclo ${cycle} está por ocurrir.`,
          "Todavía no hay una edición publicada para ese ciclo: si el cobro llega antes, las cajas se crearán sin contenido y habrá que resolverlas a mano.",
        ],
        disclaimer: "Publica la edición desde el panel antes de la fecha de cobro.",
      }),
    });
  } catch (error) {
    logger.error({ err: error, planId: input.planId }, "Fallo al enviar el aviso preventivo de edición faltante");
  }
}

export {
  sendSubscriptionPaymentConfirmedEmail,
  sendSubscriptionDunningEmail,
  sendSubscriptionAdminIncidentEmail,
  sendUpcomingEditionMissingEmail,
  resolveAdminAlertEmail,
  __setAdminAlertEmailForTests,
};
