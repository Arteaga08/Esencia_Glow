import { DEFAULT_INVENTORY_SETTINGS, type AppSettings, type InventorySettings } from "@esencia-glow/shared";
import { Settings } from "../models/settings.model.js";
import { AppError } from "../utils/app-error.js";

const SETTINGS_ID = "global";

const INVENTORY_RANGES: Record<keyof InventorySettings, { min: number; max: number }> = {
  lowStockThreshold: { min: 0, max: 100_000 },
  reservationTtlMinutes: { min: 1, max: 1_440 },
  sweepBatchSize: { min: 1, max: 1_000 },
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

/**
 * Un GET nunca escribe: si el singleton no existe, se completan los
 * defaults en memoria y se devuelven, sin crear el documento. Evita que
 * simplemente leer la configuración desde el dashboard cree filas vacías.
 */
async function getSettings(): Promise<AppSettings> {
  const doc = await Settings.findById(SETTINGS_ID).lean();
  return {
    inventory: { ...DEFAULT_INVENTORY_SETTINGS, ...doc?.inventory },
  };
}

/**
 * `$set` con rutas de punto (`inventory.<key>`) por cada campo enviado, nunca
 * `$set: { inventory: {...} }` reemplazando el subdocumento entero: así una
 * actualización parcial no pisa claves de `inventory` que no vinieron en
 * este request, y una sección hermana (home, IVA — 1.8) queda intacta.
 */
async function updateInventorySettings(input: Partial<InventorySettings>): Promise<InventorySettings> {
  assertValidInventorySettings(input);

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

export { getSettings, updateInventorySettings };
