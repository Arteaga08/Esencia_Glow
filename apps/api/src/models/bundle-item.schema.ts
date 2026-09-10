import { Schema, type Types } from "mongoose";

/**
 * Una línea de bundle: `quantity` unidades de una variante ya existente
 * (`Product.variants`). `_id: false` porque, igual que `reservationLineSchema`,
 * el array completo se reemplaza en cada `PATCH` — no hay sub-CRUD por línea.
 * `productId` se guarda aunque `variantId` ya identifica la variante: evita
 * un `Product.findOne({"variants._id": variantId})` cada vez que hace falta
 * el producto dueño (validación, cálculo de disponibilidad, DTO público).
 */
interface BundleItemAttrs {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
}

const integerValidator = { validator: Number.isInteger, message: "{PATH} debe ser un entero" };

const bundleItemSchema = new Schema<BundleItemAttrs>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true, min: 1, validate: integerValidator },
  },
  { _id: false },
);

export { bundleItemSchema };
export type { BundleItemAttrs };
