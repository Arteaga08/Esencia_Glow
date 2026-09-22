import { Types, type ClientSession } from "mongoose";
import { MAX_STATUS_HISTORY, OrderStatus, type ShippingCarrier } from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import { disputeClaimFilter } from "./order-dispute.service.js";
import type { LeanOrder } from "./order-dto.js";

/**
 * El CAS de una transición de estado de la orden, compartido por el panel
 * admin (`order-admin-status.service.ts`) y las transiciones automáticas
 * (`order-system-transition.service.ts`, 1.9). Vive aparte para que las dos
 * rutas apliquen EXACTAMENTE el mismo claim atómico — el guard real de la
 * concurrencia es el filtro `{ _id, status: <origen>, ...disputa }`, no
 * ninguna lectura previa.
 */

interface ShipmentInput {
  carrier: ShippingCarrier;
  carrierName?: string;
  trackingNumber: string;
  trackingUrl?: string;
}

/** Quién dispara la transición: un admin humano (con id, queda en la
 * bitácora como `user`) o el sistema (webhook/job, sin id). */
type OrderStatusActor = { type: "admin"; adminId: string } | { type: "system" };

interface ClaimStatusTransitionInput {
  orderId: string;
  fromStatus: OrderStatus;
  targetStatus: OrderStatus;
  actor: OrderStatusActor;
  reason?: string;
  /** Solo para `processing -> shipped`. */
  shipment?: ShipmentInput;
}

/**
 * Devuelve la orden ya actualizada, o `null` si el claim perdió: el estado
 * cambió entre la lectura del llamador y esta escritura, o se abrió un
 * contracargo justo en esa ventana. El llamador decide qué significa (el
 * admin lanza 409; el sistema lo trata como carrera legítima).
 */
async function claimStatusTransition(
  input: ClaimStatusTransitionInput,
  session?: ClientSession,
): Promise<LeanOrder | null> {
  const now = new Date();
  const setFields: Record<string, unknown> = { status: input.targetStatus };
  if (input.targetStatus === OrderStatus.SHIPPED && input.shipment) {
    setFields.shipment = { ...input.shipment, shippedAt: now };
  }

  const historyEntry =
    input.actor.type === "admin"
      ? {
          status: input.targetStatus,
          at: now,
          actorType: "user" as const,
          actorId: new Types.ObjectId(input.actor.adminId),
        }
      : { status: input.targetStatus, at: now, actorType: "system" as const };

  return Order.findOneAndUpdate(
    { _id: input.orderId, status: input.fromStatus, ...disputeClaimFilter(input.fromStatus, input.targetStatus) },
    {
      $set: setFields,
      $push: {
        statusHistory: {
          $each: [{ ...historyEntry, ...(input.reason ? { reason: input.reason } : {}) }],
          $slice: -MAX_STATUS_HISTORY,
        },
      },
    },
    { new: true, ...(session ? { session } : {}) },
  ).lean<LeanOrder>();
}

export { claimStatusTransition };
export type { ShipmentInput, OrderStatusActor, ClaimStatusTransitionInput };
