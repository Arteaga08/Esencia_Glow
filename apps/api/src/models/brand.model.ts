import { Schema, model, type HydratedDocument, type Model } from "mongoose";

/**
 * Marca comercial de un producto: solo nombre, sin imagen ni slug (no se busca
 * por URL; el storefront filtra por el nombre denormalizado en `Product.brand`).
 * El nombre es único sin distinguir mayúsculas/acentos (collation strength 1)
 * para que "Cosrx" y "COSRX" no convivan como dos marcas.
 */
interface BrandAttrs {
  name: string;
}

type BrandDocument = HydratedDocument<BrandAttrs>;
type BrandModel = Model<BrandAttrs>;

const brandSchema = new Schema<BrandAttrs, BrandModel>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
  },
  { timestamps: true },
);

brandSchema.index({ name: 1 }, { unique: true, collation: { locale: "es", strength: 1 } });

const Brand = model<BrandAttrs, BrandModel>("Brand", brandSchema);

export { Brand };
export type { BrandDocument, BrandAttrs };
