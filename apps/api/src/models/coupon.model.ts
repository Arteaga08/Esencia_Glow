import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";
import {
  COUPON_CODE_MAX_LENGTH,
  COUPON_CODE_MIN_LENGTH,
  COUPON_CODE_PATTERN,
  COUPON_DESCRIPTION_MAX_LENGTH,
  CouponDiscountType,
  CouponKind,
} from "@esencia-glow/shared";

/**
 * Cupón de descuento (Milestone 3.7). Un cupón `public` se publica fuera de
 * la tienda y lo canjea cualquier clienta hasta `maxCustomers` clientas
 * distintas; uno `personal` queda ligado a `assignedUserId` y solo ella lo
 * canjea (`maxCustomers = 1`).
 *
 * `customersCount` es el contador denormalizado de clientas distintas que lo
 * tienen tomado: decide en el MISMO `findOneAndUpdate` que lo incrementa
 * (ver coupon-redemption.service.ts), nunca un `countDocuments` previo —
 * mismo patrón que `SubscriptionPlan.seatsTaken` e `Inventory.onHand`.
 *
 * Un cupón creado no cambia de valor: solo se puede activar o desactivar,
 * así lo que una clienta vio al recibirlo es lo que canjea.
 */
interface CouponAttrs {
  code: string;
  kind: CouponKind;
  description: string;
  discountType: CouponDiscountType;
  percentOff?: number;
  amountOffCents?: number;
  minSubtotalCents?: number;
  startsAt?: Date;
  endsAt?: Date;
  isActive: boolean;
  maxCustomers?: number;
  perCustomerLimit: number;
  customersCount: number;
  assignedUserId?: Types.ObjectId;
  createdBy: Types.ObjectId;
}

type CouponDocument = HydratedDocument<CouponAttrs>;
type CouponModel = Model<CouponAttrs>;

const integerValidator = { validator: Number.isInteger, message: "{PATH} debe ser un entero" };

const couponSchema = new Schema<CouponAttrs, CouponModel>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: COUPON_CODE_MIN_LENGTH,
      maxlength: COUPON_CODE_MAX_LENGTH,
      match: COUPON_CODE_PATTERN,
    },
    kind: { type: String, required: true, enum: Object.values(CouponKind) },
    description: { type: String, trim: true, default: "", maxlength: COUPON_DESCRIPTION_MAX_LENGTH },
    discountType: { type: String, required: true, enum: Object.values(CouponDiscountType) },
    percentOff: {
      type: Number,
      min: 1,
      max: 100,
      validate: integerValidator,
      required: function (this: CouponAttrs) {
        return this.discountType === CouponDiscountType.PERCENT;
      },
    },
    amountOffCents: {
      type: Number,
      min: 1,
      validate: integerValidator,
      required: function (this: CouponAttrs) {
        return this.discountType === CouponDiscountType.FIXED;
      },
    },
    minSubtotalCents: { type: Number, min: 0, validate: integerValidator },
    startsAt: { type: Date },
    endsAt: { type: Date },
    isActive: { type: Boolean, required: true, default: true },
    maxCustomers: { type: Number, min: 1, validate: integerValidator },
    perCustomerLimit: { type: Number, required: true, default: 1, min: 1, validate: integerValidator },
    customersCount: { type: Number, required: true, default: 0, min: 0, validate: integerValidator },
    assignedUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: function (this: CouponAttrs) {
        return this.kind === CouponKind.PERSONAL;
      },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

/** El código es único sin importar mayúsculas (se guarda siempre en mayúsculas). */
couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ kind: 1, isActive: 1, createdAt: -1 });
/** Cupones personales de una clienta (panel de Clientes). */
couponSchema.index({ assignedUserId: 1 }, { partialFilterExpression: { assignedUserId: { $type: "objectId" } } });

const Coupon = model<CouponAttrs, CouponModel>("Coupon", couponSchema);

export { Coupon };
export type { CouponAttrs, CouponDocument };
