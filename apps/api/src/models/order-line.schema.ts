import { Schema, type Types } from "mongoose";

/**
 * Snapshot inmutable de una línea de orden y, si es un bundle, de sus
 * componentes. La orden NUNCA vuelve a leer el catálogo para mostrarse —
 * `attributes`/`image` congelan lo necesario para renderizar sin un fetch
 * aparte, y `sku`/`itemId` se guardan solo para commitear inventario y
 * agrupar en reportes, nunca para re-resolver qué mostrar.
 */

const integerValidator = { validator: Number.isInteger, message: "{PATH} debe ser un entero" };

interface OrderLineImageAttrs {
  url: string;
  width: number;
  height: number;
  alt?: string;
}

const orderLineImageSchema = new Schema<OrderLineImageAttrs>(
  {
    url: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    alt: { type: String, trim: true, maxlength: 200 },
  },
  { _id: false },
);

interface OrderLineAttributesAttrs {
  size?: string;
  shade?: string;
  volume?: string;
}

const orderLineAttributesSchema = new Schema<OrderLineAttributesAttrs>(
  {
    size: { type: String, trim: true, maxlength: 40 },
    shade: { type: String, trim: true, maxlength: 40 },
    volume: { type: String, trim: true, maxlength: 40 },
  },
  { _id: false },
);

/**
 * Componente de una línea de bundle. `catalogUnitPriceCents` es SOLO
 * referencia de fulfillment/devolución — el bundle cobra su propio precio
 * manual (`OrderLineAttrs.unitPriceCents`), este valor nunca suma al total
 * de la orden (ver order-totals.ts).
 */
interface OrderLineComponentAttrs {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  sku: string;
  name: string;
  variantName: string;
  quantity: number;
  catalogUnitPriceCents: number;
}

const orderLineComponentSchema = new Schema<OrderLineComponentAttrs>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    variantName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1, validate: integerValidator },
    catalogUnitPriceCents: { type: Number, required: true, min: 0, validate: integerValidator },
  },
  { _id: false },
);

interface OrderLineAttrs {
  itemType: "product" | "bundle";
  itemId: Types.ObjectId;
  sku: string;
  name: string;
  variantName?: string;
  attributes?: OrderLineAttributesAttrs;
  image?: OrderLineImageAttrs;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  /** Solo presente si `itemType === "bundle"`. */
  components?: OrderLineComponentAttrs[];
}

const orderLineSchema = new Schema<OrderLineAttrs>(
  {
    itemType: { type: String, required: true, enum: ["product", "bundle"] },
    itemId: { type: Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    variantName: { type: String, trim: true },
    attributes: { type: orderLineAttributesSchema },
    image: { type: orderLineImageSchema },
    unitPriceCents: { type: Number, required: true, min: 0, validate: integerValidator },
    quantity: { type: Number, required: true, min: 1, validate: integerValidator },
    lineTotalCents: { type: Number, required: true, min: 0, validate: integerValidator },
    components: { type: [orderLineComponentSchema], default: undefined },
  },
  { _id: false },
);

export { orderLineSchema };
export type { OrderLineAttrs, OrderLineComponentAttrs, OrderLineImageAttrs, OrderLineAttributesAttrs };
