import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import { mediaImageSchema, type MediaImageAttrs } from "./media-image.schema.js";

/**
 * Categoría de catálogo, con soporte de una subcategoría de profundidad
 * (`parentId` nullable). La invariante "máximo dos niveles" no vive aquí: un
 * `pre("save")` con `await` para consultar al padre escondería la regla en un
 * hook — vive explícita en `assertDepthInvariant` (category.service.ts).
 */
interface CategoryAttrs {
  name: string;
  slug: string;
  description?: string;
  parentId: Types.ObjectId | null;
  image?: MediaImageAttrs;
  sortOrder: number;
  isActive: boolean;
}

type CategoryDocument = HydratedDocument<CategoryAttrs>;
type CategoryModel = Model<CategoryAttrs>;

const categorySchema = new Schema<CategoryAttrs, CategoryModel>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: { type: String, trim: true, maxlength: 500 },
    parentId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    image: { type: mediaImageSchema },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Árbol público (raíz -> hijas ordenadas) y listado admin ordenado.
categorySchema.index({ parentId: 1, sortOrder: 1, name: 1 });
// Filtro de lectura pública (solo categorías activas).
categorySchema.index({ isActive: 1, parentId: 1 });

const Category = model<CategoryAttrs, CategoryModel>("Category", categorySchema);

export { Category };
export type { CategoryDocument, CategoryAttrs };
