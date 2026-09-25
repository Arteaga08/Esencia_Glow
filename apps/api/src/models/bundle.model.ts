import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { BundleStatus } from "@esencia-glow/shared";
import { mediaImageSchema, type MediaImageAttrs } from "./media-image.schema.js";
import { bundleItemSchema, type BundleItemAttrs } from "./bundle-item.schema.js";
import { productContentSchema, type ProductContentAttrs } from "./product-content.schema.js";

/**
 * Paquete: nombre, fotos y precio propios (el precio ignora la suma de sus
 * componentes), más `items` — productos/variantes ya existentes. NO tiene
 * inventario propio como fuente de verdad: `stockCache` es una caché de
 * display, recalculada de los componentes al crear/editar `items` y por el
 * cron de 1.4 (ver jobs/refresh-bundle-stock-cache.ts) — nunca se usa para
 * decidir una venta (eso lo hace `reserveStock` línea por línea, atómico,
 * al momento de reservar — ver bundle-reservation.service.ts).
 *
 * Deliberadamente sin `categoryId`: "Paquetes" es una sección propia del
 * dashboard (Milestone 2), no una `Category` real — así un admin no puede
 * borrar por accidente la categoría de la que depende todo el catálogo de
 * bundles (decisión de Manuel, 2026-09-10).
 *
 * `content`/`listPrice`/`badgeId` (Milestone 2.2.3): un paquete se vende
 * como un producto más en el storefront, así que gana los mismos tres campos
 * que `Product` tiene desde 2.2.1 — mismo schema de contenido
 * (`productContentSchema`, ver product-content.schema.ts), mismo criterio de
 * "a lo más una badge, reemplaza en vez de acumular".
 */
interface BundleAttrs {
  name: string;
  slug: string;
  description: string;
  images: Types.DocumentArray<MediaImageAttrs>;
  price: number;
  listPrice: number | null;
  badgeId: Types.ObjectId | null;
  items: BundleItemAttrs[];
  content?: ProductContentAttrs;
  status: BundleStatus;
  stockCache: number;
}

type BundleDocument = HydratedDocument<BundleAttrs>;
type BundleModel = Model<BundleAttrs>;

const bundleSchema = new Schema<BundleAttrs, BundleModel>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String, required: true, maxlength: 3000 },
    images: { type: [mediaImageSchema], default: [] },
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: "{PATH} debe ser un entero en centavos" },
    },
    listPrice: { type: Number, default: null, min: 0 },
    badgeId: { type: Schema.Types.ObjectId, ref: "Badge", default: null },
    items: {
      type: [bundleItemSchema],
      required: true,
      validate: {
        validator: (items: BundleItemAttrs[]) => items.length > 0,
        message: "Un paquete necesita al menos un componente",
      },
    },
    content: { type: productContentSchema },
    status: {
      type: String,
      enum: Object.values(BundleStatus),
      default: BundleStatus.DRAFT,
    },
    stockCache: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

bundleSchema.index({ status: 1, createdAt: -1 });
bundleSchema.index({ name: 1 });
// Lookup de integridad referencial: ¿algún bundle usa esta variante? (ver
// product-variant.service.ts, removeVariant bloquea el hard delete si sí).
bundleSchema.index({ "items.variantId": 1 });

const Bundle = model<BundleAttrs, BundleModel>("Bundle", bundleSchema);

export { Bundle };
export type { BundleDocument, BundleAttrs };
