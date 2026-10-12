import { Schema, model, type HydratedDocument, type Model } from "mongoose";
import { mediaImageSchema, type MediaImageAttrs } from "./media-image.schema.js";

/**
 * Marca comercial de un producto. El nombre es único sin distinguir
 * mayúsculas/acentos (collation strength 1) para que "Cosrx" y "COSRX" no
 * convivan como dos marcas. El storefront filtra productos por el nombre
 * denormalizado en `Product.brand`; el `slug` solo sirve para la URL de la
 * página de la marca (`/marca/[slug]`) y no cambia al renombrar, para no
 * romper enlaces. Las marcas anteriores al logo no lo traen: se les asigna la
 * primera vez que se editan (ver `brand.service.ts`). `logo` y `showOnHome`
 * alimentan la cinta de marcas del home.
 */
interface BrandAttrs {
  name: string;
  slug?: string;
  logo?: MediaImageAttrs;
  showOnHome: boolean;
}

type BrandDocument = HydratedDocument<BrandAttrs>;
type BrandModel = Model<BrandAttrs>;

const brandSchema = new Schema<BrandAttrs, BrandModel>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, trim: true, lowercase: true, maxlength: 80 },
    logo: { type: mediaImageSchema },
    showOnHome: { type: Boolean, default: false },
  },
  { timestamps: true },
);

brandSchema.index({ name: 1 }, { unique: true, collation: { locale: "es", strength: 1 } });
// Parcial: las marcas sin slug (aún no editadas) no chocan entre sí.
brandSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: "string" } } });

const Brand = model<BrandAttrs, BrandModel>("Brand", brandSchema);

export { Brand };
export type { BrandDocument, BrandAttrs };
