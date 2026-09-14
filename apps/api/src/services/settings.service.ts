import {
  DEFAULT_COMMERCE_SETTINGS,
  DEFAULT_INVENTORY_SETTINGS,
  DEFAULT_PAYMENT_SETTINGS,
  DEFAULT_SUBSCRIPTION_SETTINGS,
  type AppSettings,
  type CommerceSettings,
  type InventorySettings,
  type PaymentSettings,
  type SubscriptionSettings,
} from "@esencia-glow/shared";
import { Settings, type SubscriptionSettingsAttrs } from "../models/settings.model.js";
import { AppError } from "../utils/app-error.js";

const SETTINGS_ID = "global";

const INVENTORY_RANGES: Record<keyof InventorySettings, { min: number; max: number }> = {
  lowStockThreshold: { min: 0, max: 100_000 },
  reservationTtlMinutes: { min: 1, max: 1_440 },
  sweepBatchSize: { min: 1, max: 1_000 },
};

/**
 * `taxRateBps` tope en 10000 (100%), no en algo más ajustado: es una
 * validación de forma (puntos base válidos), la tasa real de negocio la
 * decide el admin. `freeShippingThresholdCents` sin techo superior — 0 ya
 * significa desactivado explícitamente (ver DEFAULT_COMMERCE_SETTINGS).
 */
const COMMERCE_RANGES: Record<keyof CommerceSettings, { min: number; max: number }> = {
  taxRateBps: { min: 0, max: 10_000 },
  freeShippingThresholdCents: { min: 0, max: Number.MAX_SAFE_INTEGER },
  shippingQuoteTtlMinutes: { min: 1, max: 1_440 },
};

/** Rangos de forma de `payments`: `oxxoVoucherDays` calca el límite real de
 * Stripe (1-7 días); `oxxoConfirmationGraceHours` acota entre un día (24h) y
 * diez días (240h) — más que eso ata stock por más tiempo del que Stripe
 * tarda en confirmar o fallar definitivamente una ficha. */
const PAYMENT_RANGES: Record<keyof PaymentSettings, { min: number; max: number }> = {
  oxxoVoucherDays: { min: 1, max: 7 },
  oxxoConfirmationGraceHours: { min: 24, max: 240 },
};

/** Solo `billingAnchorDay` tiene rango: `enrollmentOpen`/`enrollmentOpenedAt`/
 * `enrollmentClosesAt` no pasan por este PATCH genérico (ver
 * `SubscriptionSettingsAttrs` en settings.model.ts) — 1-28, nunca 29/30/31,
 * que es indefinido en febrero. */
type SubscriptionSettingsUpdate = Pick<SubscriptionSettings, "billingAnchorDay">;
const SUBSCRIPTION_RANGES: Record<keyof SubscriptionSettingsUpdate, { min: number; max: number }> = {
  billingAnchorDay: { min: 1, max: 28 },
};

function assertValidInventorySettings(input: Partial<InventorySettings>): void {
  for (const [key, value] of Object.entries(input) as [keyof InventorySettings, number | undefined][]) {
    if (value === undefined) continue;
    const range = INVENTORY_RANGES[key];
    if (!Number.isInteger(value) || value < range.min || value > range.max) {
      throw new AppError(`${key} debe ser un entero entre ${range.min} y ${range.max}.`, 400);
    }
  }
}

function assertValidCommerceSettings(input: Partial<CommerceSettings>): void {
  for (const [key, value] of Object.entries(input) as [keyof CommerceSettings, number | undefined][]) {
    if (value === undefined) continue;
    const range = COMMERCE_RANGES[key];
    if (!Number.isInteger(value) || value < range.min || value > range.max) {
      throw new AppError(`${key} debe ser un entero entre ${range.min} y ${range.max}.`, 400);
    }
  }
}

function assertValidPaymentSettings(input: Partial<PaymentSettings>): void {
  for (const [key, value] of Object.entries(input) as [keyof PaymentSettings, number | undefined][]) {
    if (value === undefined) continue;
    const range = PAYMENT_RANGES[key];
    if (!Number.isInteger(value) || value < range.min || value > range.max) {
      throw new AppError(`${key} debe ser un entero entre ${range.min} y ${range.max}.`, 400);
    }
  }
}

function assertValidSubscriptionSettings(input: SubscriptionSettingsUpdate): void {
  for (const [key, value] of Object.entries(input) as [
    keyof SubscriptionSettingsUpdate,
    number | undefined,
  ][]) {
    if (value === undefined) continue;
    const range = SUBSCRIPTION_RANGES[key];
    if (!Number.isInteger(value) || value < range.min || value > range.max) {
      throw new AppError(`${key} debe ser un entero entre ${range.min} y ${range.max}.`, 400);
    }
  }
}

/** Convierte las fechas del subdocumento crudo (`.lean()`) a ISO string — el
 * contrato público de `SubscriptionSettings` usa `string`, mismo criterio
 * que `SubscriberCapability.currentPeriodEnd` (capabilities.service.ts). */
function serializeSubscriptionSettings(raw?: SubscriptionSettingsAttrs): SubscriptionSettings {
  // Construido campo a campo, nunca `...raw`: el subdocumento crudo lleva
  // `Date`, y esparcirlo directo filtraría ese tipo al contrato público
  // (`string`), que es exactamente lo que este helper existe para evitar.
  return {
    billingAnchorDay: raw?.billingAnchorDay ?? DEFAULT_SUBSCRIPTION_SETTINGS.billingAnchorDay,
    enrollmentOpen: raw?.enrollmentOpen ?? DEFAULT_SUBSCRIPTION_SETTINGS.enrollmentOpen,
    ...(raw?.enrollmentOpenedAt ? { enrollmentOpenedAt: raw.enrollmentOpenedAt.toISOString() } : {}),
    ...(raw?.enrollmentClosesAt ? { enrollmentClosesAt: raw.enrollmentClosesAt.toISOString() } : {}),
  };
}

/**
 * La cotización de envío tiene que sobrevivir más que la reserva de stock
 * que la respalda: si `shippingQuoteTtlMinutes <= reservationTtlMinutes`,
 * el cliente que vuelve de la pasarela de pago puede toparse con una
 * cotización ya vencida mientras su reserva sigue viva (o peor, al revés).
 * Se valida en ambas direcciones — subir el TTL de reserva por encima del
 * de la cotización rompe la misma invariante que bajar la cotización por
 * debajo de la reserva.
 */
function assertShippingQuoteOutlivesReservation(
  reservationTtlMinutes: number,
  shippingQuoteTtlMinutes: number,
): void {
  if (shippingQuoteTtlMinutes <= reservationTtlMinutes) {
    throw new AppError(
      "El TTL de la cotización de envío debe ser mayor que el TTL de la reserva de stock.",
      400,
    );
  }
}

/**
 * Un GET nunca escribe: si el singleton no existe, se completan los
 * defaults en memoria y se devuelven, sin crear el documento. Evita que
 * simplemente leer la configuración desde el dashboard cree filas vacías.
 */
async function getSettings(): Promise<AppSettings> {
  const doc = await Settings.findById(SETTINGS_ID).lean();
  return {
    inventory: { ...DEFAULT_INVENTORY_SETTINGS, ...doc?.inventory },
    commerce: { ...DEFAULT_COMMERCE_SETTINGS, ...doc?.commerce },
    payments: { ...DEFAULT_PAYMENT_SETTINGS, ...doc?.payments },
    subscriptions: serializeSubscriptionSettings(doc?.subscriptions),
  };
}

/**
 * `$set` con rutas de punto (`inventory.<key>`) por cada campo enviado, nunca
 * `$set: { inventory: {...} }` reemplazando el subdocumento entero: así una
 * actualización parcial no pisa claves de `inventory` que no vinieron en
 * este request, y una sección hermana (commerce, home — 1.8) queda intacta.
 */
async function updateInventorySettings(input: Partial<InventorySettings>): Promise<InventorySettings> {
  assertValidInventorySettings(input);

  if (input.reservationTtlMinutes !== undefined) {
    const current = await getSettings();
    assertShippingQuoteOutlivesReservation(
      input.reservationTtlMinutes,
      current.commerce.shippingQuoteTtlMinutes,
    );
  }

  const setFields: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) setFields[`inventory.${key}`] = value;
  }

  if (Object.keys(setFields).length > 0) {
    await Settings.findOneAndUpdate({ _id: SETTINGS_ID }, { $set: setFields }, { upsert: true });
  }

  const settings = await getSettings();
  return settings.inventory;
}

/** Mismo patrón de `$set` por rutas de punto que `updateInventorySettings`,
 * para la sección `commerce` (Milestone 1.5). */
async function updateCommerceSettings(input: Partial<CommerceSettings>): Promise<CommerceSettings> {
  assertValidCommerceSettings(input);

  if (input.shippingQuoteTtlMinutes !== undefined) {
    const current = await getSettings();
    assertShippingQuoteOutlivesReservation(
      current.inventory.reservationTtlMinutes,
      input.shippingQuoteTtlMinutes,
    );
  }

  const setFields: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) setFields[`commerce.${key}`] = value;
  }

  if (Object.keys(setFields).length > 0) {
    await Settings.findOneAndUpdate({ _id: SETTINGS_ID }, { $set: setFields }, { upsert: true });
  }

  const settings = await getSettings();
  return settings.commerce;
}

/** Mismo patrón de `$set` por rutas de punto que las demás secciones —
 * sección propia, sin cruce con inventory/commerce (a diferencia del TTL de
 * envío, el plazo de la ficha OXXO no depende de otro TTL del sistema). */
async function updatePaymentSettings(input: Partial<PaymentSettings>): Promise<PaymentSettings> {
  assertValidPaymentSettings(input);

  const setFields: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) setFields[`payments.${key}`] = value;
  }

  if (Object.keys(setFields).length > 0) {
    await Settings.findOneAndUpdate({ _id: SETTINGS_ID }, { $set: setFields }, { upsert: true });
  }

  const settings = await getSettings();
  return settings.payments;
}

/** Mismo patrón de `$set` por rutas de punto que las demás secciones. Solo
 * `billingAnchorDay` — `enrollmentOpen`/`enrollmentOpenedAt`/`enrollmentClosesAt`
 * los escribe subscription-enrollment.ts, nunca este PATCH genérico. */
async function updateSubscriptionSettings(
  input: SubscriptionSettingsUpdate,
): Promise<SubscriptionSettings> {
  assertValidSubscriptionSettings(input);

  const setFields: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) setFields[`subscriptions.${key}`] = value;
  }

  if (Object.keys(setFields).length > 0) {
    await Settings.findOneAndUpdate({ _id: SETTINGS_ID }, { $set: setFields }, { upsert: true });
  }

  const settings = await getSettings();
  return settings.subscriptions;
}

export {
  getSettings,
  updateInventorySettings,
  updateCommerceSettings,
  updatePaymentSettings,
  updateSubscriptionSettings,
};
