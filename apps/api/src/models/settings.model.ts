import { Schema, model, type HydratedDocument, type Model } from "mongoose";

/**
 * Singleton de configuración de negocio, `_id` fijo ("global"). Diseñado por
 * secciones: cada milestone que necesita un umbral configurable le suma su
 * propia clave (1.8 sumará `home`) sin tocar las demás — el service
 * actualiza siempre con rutas `$set` con puntos (`inventory.lowStockThreshold`,
 * `commerce.taxRateBps`), nunca reemplazando el documento entero, así que
 * una sección nueva jamás pisa a las que ya existen.
 *
 * Los campos de cada sección son todos opcionales en el schema: un
 * documento puede existir con solo algunas claves seteadas (actualizaciones
 * parciales sucesivas); `settings.service.ts` completa lo faltante con los
 * defaults al leer, nunca al escribir.
 */
interface InventorySettingsAttrs {
  lowStockThreshold?: number;
  reservationTtlMinutes?: number;
  sweepBatchSize?: number;
}

/** Sección de negocio del checkout (Milestone 1.5): IVA y envío gratis. */
interface CommerceSettingsAttrs {
  taxRateBps?: number;
  freeShippingThresholdCents?: number;
  shippingQuoteTtlMinutes?: number;
}

interface SettingsAttrs {
  _id: string;
  inventory?: InventorySettingsAttrs;
  commerce?: CommerceSettingsAttrs;
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

const commerceSettingsSchema = new Schema<CommerceSettingsAttrs>(
  {
    taxRateBps: { type: Number },
    freeShippingThresholdCents: { type: Number },
    shippingQuoteTtlMinutes: { type: Number },
  },
  { _id: false },
);

const settingsSchema = new Schema<SettingsAttrs, SettingsModel>(
  {
    _id: { type: String },
    inventory: { type: inventorySettingsSchema },
    commerce: { type: commerceSettingsSchema },
  },
  { timestamps: true },
);

const Settings = model<SettingsAttrs, SettingsModel>("Settings", settingsSchema);

export { Settings };
export type { SettingsAttrs, SettingsDocument, InventorySettingsAttrs, CommerceSettingsAttrs };
