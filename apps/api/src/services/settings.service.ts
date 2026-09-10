import {
  DEFAULT_COMMERCE_SETTINGS,
  DEFAULT_INVENTORY_SETTINGS,
  type AppSettings,
  type CommerceSettings,
  type InventorySettings,
} from "@esencia-glow/shared";
import { Settings } from "../models/settings.model.js";
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

export { getSettings, updateInventorySettings, updateCommerceSettings };
