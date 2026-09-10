import { Schema } from "mongoose";

/**
 * Paquete cotizado/comprado — mismo shape que produce `buildParcel`
 * (services/parcel.ts). Se congela tanto en `ShippingQuote` como en `Order`
 * para que la heurística de 1.9 pueda cambiar sin alterar cómo se ven los
 * pedidos ya hechos.
 */
interface ParcelAttrs {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  volumetricWeightGrams: number;
}

const integerValidator = { validator: Number.isInteger, message: "{PATH} debe ser un entero" };

const parcelSchema = new Schema<ParcelAttrs>(
  {
    weightGrams: { type: Number, required: true, min: 1, validate: integerValidator },
    lengthCm: { type: Number, required: true, min: 1, validate: integerValidator },
    widthCm: { type: Number, required: true, min: 1, validate: integerValidator },
    heightCm: { type: Number, required: true, min: 1, validate: integerValidator },
    volumetricWeightGrams: { type: Number, required: true, min: 0, validate: integerValidator },
  },
  { _id: false },
);

export { parcelSchema };
export type { ParcelAttrs };
