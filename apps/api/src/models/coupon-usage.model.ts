import { Schema, model, type HydratedDocument, type Model, type Types } from "mongoose";

/**
 * Usos de un cupón por clienta (Milestone 3.7). Una fila por `{couponId,
 * userId}`; `uses` cuenta los pedidos vivos que lo canjearon (un pedido
 * cancelado o expirado devuelve su uso, ver `releaseCouponUse`). El índice
 * único es la red de seguridad contra dos filas para la misma pareja.
 */
interface CouponUsageAttrs {
  couponId: Types.ObjectId;
  userId: Types.ObjectId;
  uses: number;
}

type CouponUsageDocument = HydratedDocument<CouponUsageAttrs>;
type CouponUsageModel = Model<CouponUsageAttrs>;

const couponUsageSchema = new Schema<CouponUsageAttrs, CouponUsageModel>(
  {
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    uses: { type: Number, required: true, default: 0, min: 0, validate: { validator: Number.isInteger, message: "{PATH} debe ser un entero" } },
  },
  { timestamps: true },
);

couponUsageSchema.index({ couponId: 1, userId: 1 }, { unique: true });

const CouponUsage = model<CouponUsageAttrs, CouponUsageModel>("CouponUsage", couponUsageSchema);

export { CouponUsage };
export type { CouponUsageAttrs, CouponUsageDocument };
