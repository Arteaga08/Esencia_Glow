import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { ProductStatus } from "@esencia-glow/shared";
import { mediaImageSchema, type MediaImageAttrs } from "./media-image.schema.js";
import { productVariantSchema, type ProductVariantAttrs } from "./product-variant.schema.js";

/**
 * Producto con variantes embebidas. `minPrice` es un campo DERIVADO (precio
 * más bajo entre variantes activas), recalculado en `pre("save")` para poder
 * ordenar/filtrar por precio con índice sin ordenar sobre un array.
 *
 * Consecuencia obligatoria de que sea derivado: el hook NO corre en
 * `findOneAndUpdate`/`updateOne`/`bulkWrite`. Toda mutación de variantes o
 * precios debe pasar por `doc.save()` (ver product-variant.service.ts) — un
 * `findByIdAndUpdate` directo sobre `variants` deja `minPrice` desincronizado
 * sin que nada falle, y el listado por precio ordena mal en silencio.
 */
interface ProductAttrs {
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  categoryId: Types.ObjectId;
  // A lo más una badge por producto: asignar otra reemplaza esta referencia,
  // nunca un arreglo (decisión 1.4.2, esencia-glow-decisiones).
  badgeId: Types.ObjectId | null;
  status: ProductStatus;
  // `Types.DocumentArray` (no un array plano) para que `.id()` y el
  // `.deleteOne()` de cada elemento (usados en catalog-image.service.ts y
  // product-variant.service.ts) queden tipados.
  images: Types.DocumentArray<MediaImageAttrs>;
  variants: Types.DocumentArray<ProductVariantAttrs>;
  minPrice: number;
}

type ProductDocument = HydratedDocument<ProductAttrs>;
type ProductModel = Model<ProductAttrs>;

const productSchema = new Schema<ProductAttrs, ProductModel>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String, required: true, maxlength: 5000 },
    shortDescription: { type: String, trim: true, maxlength: 300 },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    badgeId: { type: Schema.Types.ObjectId, ref: "Badge", default: null },
    status: {
      type: String,
      enum: Object.values(ProductStatus),
      default: ProductStatus.DRAFT,
    },
    images: { type: [mediaImageSchema], default: [] },
    variants: { type: [productVariantSchema], default: [] },
    minPrice: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// El índice único sobre "variants.sku" es multikey: la unicidad aplica ENTRE
// documentos, no dentro de uno mismo (dos variantes del mismo producto con el
// mismo SKU no la violan). La defensa intra-documento vive en Joi
// (product.validator.ts) y en product-variant.service.ts. `sparse` evita que
// dos productos sin variantes (borradores) choquen en la clave `undefined`.
productSchema.index({ "variants.sku": 1 }, { unique: true, sparse: true });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ status: 1, categoryId: 1, minPrice: 1 });
productSchema.index({ name: 1 });

productSchema.pre("save", function recomputeMinPrice(next) {
  const activePrices = this.variants.filter((variant) => variant.isActive).map((v) => v.price);
  this.minPrice = activePrices.length > 0 ? Math.min(...activePrices) : 0;
  next();
});

const Product = model<ProductAttrs, ProductModel>("Product", productSchema);

export { Product };
export type { ProductDocument, ProductAttrs };
