import type { ClientSession, Types } from "mongoose";
import { ErrorCode, type CouponDiscountType } from "@esencia-glow/shared";
import { Coupon, type CouponDocument } from "../models/coupon.model.js";
import { CouponUsage } from "../models/coupon-usage.model.js";
import { AppError } from "../utils/app-error.js";
import { computeCouponDiscount } from "./coupon-discount.js";
import { assertCouponApplicable, normalizeCouponCode } from "./coupon-rules.js";

/**
 * Canje y liberación de cupones (Milestone 3.7). Ambas funciones corren
 * DENTRO de una transacción que ya es dueña de la `session` (el checkout, o
 * el cierre de un pedido `pending`): si el pedido no se crea, la transacción
 * deshace el canje por completo.
 *
 * Los topes se deciden en el MISMO `findOneAndUpdate` que incrementa el
 * contador — nunca un `countDocuments` previo, que es read-then-write
 * (mismo precedente que `claimSeat` de suscripciones e `Inventory.onHand`).
 * Dos checkouts concurrentes sobre el mismo cupón chocan como
 * `WriteConflict` y `withTransaction` reintenta al perdedor, que en el
 * reintento ya ve el contador del ganador.
 *
 * Se lee primero (`findOne` dentro de la misma transacción) para decidir la
 * rama, en vez de "crear y atrapar el E11000": un error de escritura aborta
 * la transacción del lado del servidor y seguir escribiendo en ella falla
 * siempre (ver `subscription-seat.service.ts::startSubscription`).
 *
 * Aceptado: desactivar un cupón justo mientras se canjea no lo frena para
 * ese pedido en vuelo (la lectura de `isActive` es previa al canje). El
 * pedido ya reservó stock y conserva el cupón con el que se creó.
 */

interface ClaimCouponUseInput {
  code: string;
  userId: string;
  /** Subtotal de artículos antes del descuento, sin envío. */
  subtotalCents: number;
  now?: Date;
}

/** Lo que el pedido congela del cupón, más el descuento ya calculado. */
interface ClaimedCoupon {
  couponId: Types.ObjectId;
  code: string;
  discountType: CouponDiscountType;
  percentOff?: number;
  amountOffCents?: number;
  discountCents: number;
}

/** Toma un lugar de persona del tope. Sin tope de personas solo cuenta. */
async function takeCustomerSlot(coupon: CouponDocument, session: ClientSession): Promise<void> {
  const hasCap = coupon.maxCustomers !== undefined && coupon.maxCustomers !== null;
  const claimed = await Coupon.findOneAndUpdate(
    {
      _id: coupon._id,
      isActive: true,
      ...(hasCap ? { $expr: { $lt: ["$customersCount", "$maxCustomers"] } } : {}),
    },
    { $inc: { customersCount: 1 } },
    { new: true, session },
  );
  if (claimed) return;
  throw hasCap
    ? new AppError("Este cupón ya alcanzó su límite de personas.", 409, undefined, ErrorCode.COUPON_EXHAUSTED)
    : new AppError("Ese código no existe o ya no está disponible.", 409, undefined, ErrorCode.COUPON_INVALID);
}

function alreadyUsed(): AppError {
  return new AppError("Ya usaste este cupón.", 409, undefined, ErrorCode.COUPON_ALREADY_USED);
}

async function claimCouponUse(input: ClaimCouponUseInput, session: ClientSession): Promise<ClaimedCoupon> {
  const coupon = await Coupon.findOne({ code: normalizeCouponCode(input.code) }).session(session);
  if (!coupon) {
    throw new AppError("Ese código no existe o ya no está disponible.", 409, undefined, ErrorCode.COUPON_INVALID);
  }

  assertCouponApplicable(coupon, {
    userId: input.userId,
    subtotalCents: input.subtotalCents,
    now: input.now ?? new Date(),
  });

  const usage = await CouponUsage.findOne({ couponId: coupon._id, userId: input.userId }).session(session);
  const currentUses = usage?.uses ?? 0;
  if (currentUses >= coupon.perCustomerLimit) throw alreadyUsed();

  // Una clienta con usos vigentes ya ocupa su lugar de persona; el primer
  // uso (o el primero tras liberar todos) es el que lo toma.
  if (currentUses === 0) await takeCustomerSlot(coupon, session);

  if (usage) {
    const updated = await CouponUsage.findOneAndUpdate(
      { _id: usage._id, uses: currentUses },
      { $inc: { uses: 1 } },
      { new: true, session },
    );
    if (!updated) throw alreadyUsed();
  } else {
    await CouponUsage.create([{ couponId: coupon._id, userId: input.userId, uses: 1 }], { session });
  }

  return {
    couponId: coupon._id,
    code: coupon.code,
    discountType: coupon.discountType,
    ...(coupon.percentOff !== undefined && coupon.percentOff !== null ? { percentOff: coupon.percentOff } : {}),
    ...(coupon.amountOffCents !== undefined && coupon.amountOffCents !== null ? { amountOffCents: coupon.amountOffCents } : {}),
    discountCents: computeCouponDiscount({
      discountType: coupon.discountType,
      ...(coupon.percentOff !== undefined && coupon.percentOff !== null ? { percentOff: coupon.percentOff } : {}),
      ...(coupon.amountOffCents !== undefined && coupon.amountOffCents !== null ? { amountOffCents: coupon.amountOffCents } : {}),
      subtotalCents: input.subtotalCents,
    }),
  };
}

interface ReleaseCouponUseInput {
  couponId: Types.ObjectId;
  userId: string | Types.ObjectId;
}

/**
 * Devuelve el uso de un pedido cancelado o expirado. `uses > 0` en el filtro
 * es la guarda que impide contadores negativos y hace la liberación
 * idempotente; el lugar de persona vuelve solo cuando la clienta se queda sin
 * usos. Devuelve `true` si ESTA llamada liberó un uso.
 */
async function releaseCouponUse(input: ReleaseCouponUseInput, session: ClientSession): Promise<boolean> {
  const usage = await CouponUsage.findOneAndUpdate(
    { couponId: input.couponId, userId: input.userId, uses: { $gt: 0 } },
    { $inc: { uses: -1 } },
    { new: true, session },
  );
  if (!usage) return false;

  if (usage.uses === 0) {
    await Coupon.updateOne(
      { _id: input.couponId, $expr: { $gt: ["$customersCount", 0] } },
      { $inc: { customersCount: -1 } },
      { session },
    );
  }
  return true;
}

/** Pedido con lo mínimo que hace falta para devolver su cupón. */
interface CouponHoldingOrder {
  userId: Types.ObjectId;
  coupon?: { couponId: Types.ObjectId } | null;
}

/** Devuelve el uso del cupón de un pedido que se cierra; `false` si no traía cupón o ya estaba liberado. */
async function releaseOrderCoupon(order: CouponHoldingOrder, session: ClientSession): Promise<boolean> {
  if (!order.coupon) return false;
  return releaseCouponUse({ couponId: order.coupon.couponId, userId: order.userId }, session);
}

export { claimCouponUse, releaseCouponUse, releaseOrderCoupon };
export type { ClaimCouponUseInput, ClaimedCoupon, ReleaseCouponUseInput, CouponHoldingOrder };
