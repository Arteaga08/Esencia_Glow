import { Schema } from "mongoose";

/**
 * Subschemas de una variante de producto. El SKU, precio (centavos MXN) y las
 * medidas de envío viven aquí porque el inventario (Milestone 1.4) y la
 * cotización de Skydropx (Milestone 1.5) operan por variante, nunca por
 * producto. `attributes` usa claves fijas (no un `Map`) porque son exactamente
 * las tres que el catálogo modela hoy — un Map abriría claves arbitrarias que
 * ni el admin ni el storefront saben renderizar.
 */

const SKU_PATTERN = /^[A-Z0-9-]{3,32}$/;

interface VariantAttributesAttrs {
  size?: string;
  shade?: string;
  volume?: string;
}

interface DimensionsCmAttrs {
  length: number;
  width: number;
  height: number;
}

interface ProductVariantAttrs {
  sku: string;
  name: string;
  attributes: VariantAttributesAttrs;
  /** Centavos MXN. Entero — ver validator abajo. */
  price: number;
  /** Gramos, entero. Cotización de envío (Milestone 1.5). */
  weightGrams: number;
  dimensionsCm: DimensionsCmAttrs;
  isActive: boolean;
}

const variantAttributesSchema = new Schema<VariantAttributesAttrs>(
  {
    size: { type: String, trim: true, maxlength: 40 },
    shade: { type: String, trim: true, maxlength: 40 },
    volume: { type: String, trim: true, maxlength: 40 },
  },
  { _id: false },
);

const dimensionsCmSchema = new Schema<DimensionsCmAttrs>(
  {
    length: { type: Number, required: true, min: 0.1 },
    width: { type: Number, required: true, min: 0.1 },
    height: { type: Number, required: true, min: 0.1 },
  },
  { _id: false },
);

const integerValidator = {
  validator: Number.isInteger,
  message: "{PATH} debe ser un entero",
};

const productVariantSchema = new Schema<ProductVariantAttrs>(
  {
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: SKU_PATTERN,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    attributes: { type: variantAttributesSchema, default: () => ({}) },
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: integerValidator,
    },
    weightGrams: {
      type: Number,
      required: true,
      min: 1,
      validate: integerValidator,
    },
    dimensionsCm: { type: dimensionsCmSchema, required: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: true },
);

export { productVariantSchema, SKU_PATTERN };
export type { ProductVariantAttrs, VariantAttributesAttrs, DimensionsCmAttrs };
