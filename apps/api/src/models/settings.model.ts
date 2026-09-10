import { Schema, model, type HydratedDocument, type Model } from "mongoose";

/**
 * Singleton de configuración de negocio, `_id` fijo ("global"). Diseñado por
 * secciones: cada milestone que necesita un umbral configurable le suma su
 * propia clave (1.8 sumará `home`, IVA, envío gratis) sin tocar las demás —
 * el service actualiza siempre con rutas `$set` con puntos
 * (`inventory.lowStockThreshold`), nunca reemplazando el documento entero,
 * así que una sección nueva jamás pisa a las que ya existen.
 *
 * Los campos de `inventory` son todos opcionales en el schema: un documento
 * puede existir con solo algunas claves seteadas (actualizaciones parciales
 * sucesivas); `settings.service.ts` completa lo faltante con los defaults al
 * leer, nunca al escribir.
 */
interface InventorySettingsAttrs {
  lowStockThreshold?: number;
  reservationTtlMinutes?: number;
  sweepBatchSize?: number;
}

interface SettingsAttrs {
  _id: string;
  inventory?: InventorySettingsAttrs;
}

type SettingsDocument = HydratedDocument<SettingsAttrs>;
type SettingsModel = Model<SettingsAttrs>;

const inventorySettingsSchema = new Schema<InventorySettingsAttrs>(
  {
    lowStockThreshold: { type: Number },
    reservationTtlMinutes: { type: Number },
    sweepBatchSize: { type: Number },
  },
  { _id: false },
);

const settingsSchema = new Schema<SettingsAttrs, SettingsModel>(
  {
    _id: { type: String },
    inventory: { type: inventorySettingsSchema },
  },
  { timestamps: true },
);

const Settings = model<SettingsAttrs, SettingsModel>("Settings", settingsSchema);

export { Settings };
export type { SettingsAttrs, SettingsDocument, InventorySettingsAttrs };
