import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";

/**
 * Inventario por variante, en colección aparte de `Product`: el `pre("save")`
 * que recalcula `minPrice` en product.model.ts no corre en
 * `findOneAndUpdate`, así que el update atómico de stock jamás puede vivir
 * sobre `products.variants` sin desincronizar el precio en silencio.
 *
 * `onHand` (físico) y `reserved` (apartado por reservas activas) se llevan
 * por separado; disponible = onHand - reserved se calcula en el DTO, nunca
 * se persiste.
 *
 * `min: 0` de abajo es solo la validación de un `save()` normal — NO protege
 * nada bajo `$inc` (ver inventory.model.test.ts, "min:0 no protege"). La
 * invariante real vive en el `$expr` de cada `findOneAndUpdate` de
 * inventory.service.ts / stock-reservation.service.ts: la condición y el
 * `$inc` viajan en el mismo comando, nunca leer-decidir-escribir.
 *
 * Deliberadamente sin índice sobre `onHand`/`reserved`: el filtro de stock
 * bajo es un `$expr` (onHand - reserved <= threshold) y no puede usar índice;
 * con una fila por variante (cientos, no millones), el collscan es la
 * respuesta correcta — no lo "optimices" con un índice inútil.
 */
interface InventoryAttrs {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  sku: string;
  onHand: number;
  reserved: number;
}

type InventoryDocument = HydratedDocument<InventoryAttrs>;
type InventoryModel = Model<InventoryAttrs>;

const integerValidator = { validator: Number.isInteger, message: "{PATH} debe ser un entero" };

const inventorySchema = new Schema<InventoryAttrs, InventoryModel>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId, required: true, unique: true },
    sku: { type: String, required: true, trim: true, uppercase: true, unique: true },
    onHand: { type: Number, required: true, default: 0, min: 0, validate: integerValidator },
    reserved: { type: Number, required: true, default: 0, min: 0, validate: integerValidator },
  },
  { timestamps: true },
);

inventorySchema.index({ productId: 1 });
inventorySchema.index({ updatedAt: -1 });

const Inventory = model<InventoryAttrs, InventoryModel>("Inventory", inventorySchema);

export { Inventory };
export type { InventoryAttrs, InventoryDocument };
