import { Schema, type Types } from "mongoose";

/**
 * Un ítem de la caja de una `SubscriptionEdition`: `quantity` unidades de una
 * variante ya existente (`Product.variants`, canal `subscription`). `_id:
 * false` porque, igual que `bundleItemSchema`, el array completo se
 * reemplaza en cada `PATCH` mientras la edición sigue en `draft` — no hay
 * sub-CRUD por línea. `productId` se guarda aunque `variantId` ya identifica
 * la variante: evita un `Product.findOne({"variants._id": variantId})` cada
 * vez que hace falta el producto dueño (validación al publicar, DTO admin).
 */
interface EditionItemAttrs {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
}

const integerValidator = { validator: Number.isInteger, message: "{PATH} debe ser un entero" };

const editionItemSchema = new Schema<EditionItemAttrs>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true, min: 1, validate: integerValidator },
  },
  { _id: false },
);

export { editionItemSchema };
export type { EditionItemAttrs };
