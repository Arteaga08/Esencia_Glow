import { Types, type ClientSession } from "mongoose";
import { SubscriptionAction, SubscriptionShipmentStatus } from "@esencia-glow/shared";
import type { ShippingCarrier } from "@esencia-glow/shared";
import { Inventory } from "../models/inventory.model.js";
import { SubscriptionShipment, type SubscriptionShipmentDocument } from "../models/subscription-shipment.model.js";
import type { ReservedShipmentItemAttrs } from "../models/reserved-shipment-item.schema.js";
import { AppError } from "../utils/app-error.js";
import { withTransaction } from "../utils/with-transaction.js";
import { recordAudit } from "./audit.service.js";
import { assertShipmentTransition, shipmentStockEffect } from "./subscription-shipment-state.js";
import type { SubscriptionActor } from "./subscription-state.js";

/**
 * Transiciones del envío del ciclo desde el panel (Milestone 1.7.2b, Fase 3).
 * Es el otro extremo de `subscription-shipment.service.ts`: aquel APARTA el
 * inventario al cobrarse el ciclo, este lo saca del almacén al enviar o lo
 * devuelve al cancelar.
 *
 * Todo ocurre dentro de `withTransaction`, lectura incluida: su contrato
 * prohíbe leer antes de entrar (el callback se reejecuta completo ante un
 * WriteConflict, y una lectura de fuera quedaría rancia en el reintento).
 * Ese reintento es justamente lo que hace correcta la concurrencia aquí: dos
 * panelistas marcando "enviado" a la vez producen un WriteConflict, el
 * perdedor reejecuta, relee el envío ya `shipped` y muere en
 * `assertShipmentTransition` con 409 — el stock se descuenta UNA sola vez.
 */

interface ChangeShipmentStatusInput {
  shipmentId: string;
  to: SubscriptionShipmentStatus;
  actor: SubscriptionActor;
  carrier?: ShippingCarrier;
  trackingNumber?: string;
}

/**
 * Compromete el stock apartado de la caja: `reserved` y `onHand` bajan en la
 * misma cantidad, con la condición y el `$inc` en un solo `findOneAndUpdate`
 * — calco de `commitReservationCore` en stock-reservation.service.ts, que no
 * se puede reusar porque opera sobre un `StockReservation` y la caja guarda
 * sus líneas inline (`reservedItems`) a propósito.
 *
 * Si una línea no matchea, el inventario fue alterado por fuera: 409 y la
 * transacción entera aborta — jamás un commit a medias.
 */
async function commitReservedItems(
  items: ReservedShipmentItemAttrs[],
  session: ClientSession,
): Promise<void> {
  for (const item of items) {
    const updated = await Inventory.findOneAndUpdate(
      { variantId: item.variantId, reserved: { $gte: item.quantity } },
      { $inc: { onHand: -item.quantity, reserved: -item.quantity } },
      { new: true, session },
    );
    if (!updated) {
      throw new AppError(
        `Inventario inconsistente al comprometer la variante ${item.variantId.toString()}.`,
        409,
      );
    }
  }
}

/** Devuelve la reserva al pozo disponible. Mismo `$gte` defensivo: soltar más
 * de lo apartado dejaría `reserved` negativo y falsearía el disponible de
 * todas las demás cajas. */
async function releaseReservedItems(
  items: ReservedShipmentItemAttrs[],
  session: ClientSession,
): Promise<void> {
  for (const item of items) {
    const updated = await Inventory.findOneAndUpdate(
      { variantId: item.variantId, reserved: { $gte: item.quantity } },
      { $inc: { reserved: -item.quantity } },
      { new: true, session },
    );
    if (!updated) {
      throw new AppError(
        `Inventario inconsistente al liberar la variante ${item.variantId.toString()}.`,
        409,
      );
    }
  }
}

/** Sellos de fecha por estado destino, escritos en la MISMA operación que la
 * transición — nunca un `save()` aparte que pudiera quedarse a medias. */
function stampsFor(to: SubscriptionShipmentStatus, now: Date): Record<string, unknown> {
  switch (to) {
    case SubscriptionShipmentStatus.SHIPPED:
      return { shippedAt: now };
    case SubscriptionShipmentStatus.DELIVERED:
      return { deliveredAt: now };
    case SubscriptionShipmentStatus.CANCELED:
      return { canceledAt: now };
    default:
      return {};
  }
}

async function changeShipmentStatus(input: ChangeShipmentStatusInput): Promise<SubscriptionShipmentDocument> {
  if (!Types.ObjectId.isValid(input.shipmentId)) {
    throw new AppError("Envío no encontrado.", 404);
  }

  // `from` viaja DE VUELTA desde el closure, nunca en una variable capturada
  // de fuera: `withTransaction` reejecuta el callback completo ante un
  // WriteConflict, y su contrato prohíbe explícitamente el estado mutable
  // externo (sobreviviría al abort y se duplicaría en el reintento).
  const { shipment: updated, from } = await withTransaction(async (session) => {
    const shipment = await SubscriptionShipment.findById(input.shipmentId).session(session);
    if (!shipment) throw new AppError("Envío no encontrado.", 404);

    assertShipmentTransition(shipment.status, input.to, input.actor);

    // La guía es obligatoria para enviar: una caja marcada como enviada sin
    // número de rastreo deja a la suscriptora sin forma de ubicarla y a
    // soporte sin nada que consultar.
    if (input.to === SubscriptionShipmentStatus.SHIPPED && (!input.carrier || !input.trackingNumber)) {
      throw new AppError("Captura la paquetería y el número de guía para marcar el envío como enviado.", 400);
    }

    const from = shipment.status;
    const now = new Date();
    const effect = shipmentStockEffect(from, input.to);

    const claimed = await SubscriptionShipment.findOneAndUpdate(
      { _id: shipment._id, status: shipment.status },
      {
        $set: {
          status: input.to,
          ...stampsFor(input.to, now),
          ...(effect === "commit" ? { stockCommittedAt: now } : {}),
          ...(input.to === SubscriptionShipmentStatus.SHIPPED
            ? { carrier: input.carrier, trackingNumber: input.trackingNumber }
            : {}),
        },
      },
      { new: true, session },
    );
    if (!claimed) {
      throw new AppError("El envío cambió de estado, vuelve a intentarlo.", 409);
    }

    if (effect === "commit") await commitReservedItems(claimed.reservedItems, session);
    if (effect === "release") await releaseReservedItems(claimed.reservedItems, session);

    return { shipment: claimed, from };
  });

  await recordAudit({
    action: SubscriptionAction.SHIPMENT_STATUS_CHANGED,
    targetId: updated._id,
    metadata: { from, to: input.to },
  });

  return updated;
}

export { changeShipmentStatus };
export type { ChangeShipmentStatusInput };
