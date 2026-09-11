import { Types } from "mongoose";
import { MAX_INTERNAL_NOTES, OrderAction, OrderStatus, type OrderPriority } from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import type { ShippingAddressAttrs } from "../models/shipping-address.schema.js";
import { AppError } from "../utils/app-error.js";
import { recordAudit } from "./audit.service.js";
import type { LeanOrder } from "./order-dto.js";

/**
 * Correcciones de campo del panel admin sobre una orden (dirección,
 * prioridad, notas internas — §J del plan de 1.5), separado de
 * `order-admin-status.service.ts` (transiciones + guía) por el tope de 250
 * líneas por archivo del repo. Ninguna de estas escrituras toca `status`
 * ni `statusHistory`.
 */

const ADDRESS_LOCKED_STATUSES: readonly OrderStatus[] = [
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
];

/**
 * Bloqueada en `shipped`/`delivered`/`cancelled`/`refunded` — una dirección
 * editable después de enviar redirige un pedido ya despachado. El guard
 * (`status: {$nin: ADDRESS_LOCKED_STATUSES}`) viaja en el MISMO
 * `findOneAndUpdate`: un `findById` + check + `findByIdAndUpdate`
 * incondicionado dejaría una ventana donde un `changeOrderStatus`
 * concurrente mueva la orden a `shipped` DESPUÉS del check pero ANTES del
 * write, permitiendo corregir la dirección de un pedido ya despachado.
 */
async function correctShippingAddress(
  orderId: string,
  adminId: string,
  address: ShippingAddressAttrs,
): Promise<LeanOrder> {
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, status: { $nin: ADDRESS_LOCKED_STATUSES } },
    { $set: { shippingAddress: address } },
    { new: true },
  ).lean<LeanOrder>();

  if (!updated) {
    const existing = await Order.findById(orderId).select("status").lean();
    if (!existing) throw new AppError("Pedido no encontrado.", 404);
    throw new AppError(`No se puede corregir la dirección de un pedido en estado "${existing.status}".`, 409);
  }

  await recordAudit({ action: OrderAction.ORDER_SHIPPING_ADDRESS_UPDATED, actorId: adminId, targetId: updated._id });
  return updated;
}

/** Independiente de `status`: NUNCA se valida en la máquina de estados ni
 * dispara una transición ni toca `statusHistory` — solo cambia dónde
 * ordena en la cola del panel. */
async function changeOrderPriority(orderId: string, adminId: string, priority: OrderPriority): Promise<LeanOrder> {
  const updated = await Order.findByIdAndUpdate(orderId, { $set: { priority } }, { new: true }).lean<LeanOrder>();
  if (!updated) throw new AppError("Pedido no encontrado.", 404);
  await recordAudit({ action: OrderAction.ORDER_PRIORITY_UPDATED, actorId: adminId, targetId: updated._id, metadata: { priority } });
  return updated;
}

/** Staff-a-staff, append-only. El cuerpo de la nota NUNCA se duplica en el
 * audit log — el log solo dice que se agregó una nota, no qué decía. */
async function addInternalNote(orderId: string, adminId: string, body: string): Promise<LeanOrder> {
  const updated = await Order.findByIdAndUpdate(
    orderId,
    {
      $push: {
        internalNotes: {
          $each: [{ body, authorId: new Types.ObjectId(adminId), at: new Date() }],
          $slice: -MAX_INTERNAL_NOTES,
        },
      },
    },
    { new: true },
  ).lean<LeanOrder>();
  if (!updated) throw new AppError("Pedido no encontrado.", 404);
  await recordAudit({ action: OrderAction.ORDER_NOTE_ADDED, actorId: adminId, targetId: updated._id });
  return updated;
}

export { correctShippingAddress, changeOrderPriority, addInternalNote };
