import { Types } from "mongoose";
import type { ListQuery, PaginationMeta } from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import { AppError } from "../utils/app-error.js";
import { buildMeta } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import type { LeanOrder } from "./order-dto.js";
import { createOrder } from "./create-order.service.js";
import { computeRequestHash } from "./create-order-mappers.js";
import type { CreateOrderInput, CreateOrderResult } from "./create-order.service.js";
import { closePendingOrder } from "./order-closing.service.js";

/**
 * Lectura y cancelación de órdenes propias del cliente. `createOrder` (el
 * checkout) vive en create-order.service.ts desde el Milestone 1.6 (este
 * archivo ya medía 404 líneas) — se re-exporta aquí para no romper a los
 * callers existentes.
 */

const MY_ORDER_SORT_FIELDS = ["createdAt", "totalCents", "status"] as const;

interface ListMyOrdersInput extends ListQuery {
  userId: string;
}

/** Lectura del cliente — SIEMPRE filtrada por `userId` en la query, nunca
 * un check posterior (ver AppError de anti-IDOR en `getMyOrder`). */
async function listMyOrders(input: ListMyOrdersInput): Promise<{ rows: LeanOrder[]; meta: PaginationMeta }> {
  const filter = { userId: new Types.ObjectId(input.userId) };

  const [rows, total] = await Promise.all([
    Order.find(filter)
      .sort(resolveSort(input.sort, MY_ORDER_SORT_FIELDS, "createdAt"))
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean<LeanOrder[]>(),
    Order.countDocuments(filter),
  ]);

  return { rows, meta: buildMeta(total, input) };
}

/**
 * Anti-IDOR: la propiedad viaja DENTRO del filtro (`{_id, userId}`), nunca
 * como un check después de cargar por `_id` a secas. Un miss (no existe O
 * es de otro usuario) responde 404 — nunca 403, que confirmaría que la
 * orden existe (ver plan de 1.5 §H).
 */
async function getMyOrder(orderId: string, userId: string): Promise<LeanOrder> {
  const order = await Order.findOne({ _id: orderId, userId }).lean<LeanOrder>();
  if (!order) throw new AppError("Pedido no encontrado.", 404);
  return order;
}

/**
 * Cancela una orden propia — delega en `closePendingOrder` (Milestone 1.6
 * §D): si ya existe un PaymentIntent, consulta/cancela primero en Stripe
 * ("Stripe-first") antes de tocar inventario. Si Stripe ya capturó el pago
 * (carrera cliente-cancela / webhook-confirma), NO se cancela — se
 * liquida a `paid` y el cliente ve 409 "tu pago ya se procesó".
 */
async function cancelMyOrder(orderId: string, userId: string): Promise<LeanOrder> {
  const result = await closePendingOrder(orderId, "customer", { userId });

  if (result.outcome === "already_paid") {
    throw new AppError("Tu pago ya se procesó, este pedido no se puede cancelar.", 409);
  }
  if (result.outcome === "payment_anomaly") {
    // La orden NO se pagó (monto/moneda no cuadran, o llegó sobre un pedido
    // ya cerrado) — sigue `pending`, marcada para revisión humana. Decirle
    // "ya se procesó" sería falso; el mensaje correcto es que hay que
    // esperar a que se resuelva.
    throw new AppError("Tu pago está en revisión, contacta a soporte para resolver tu pedido.", 409);
  }

  return result.order!.toObject() as unknown as LeanOrder;
}

export { createOrder, computeRequestHash, listMyOrders, getMyOrder, cancelMyOrder };
export type { CreateOrderInput, CreateOrderResult, ListMyOrdersInput };
