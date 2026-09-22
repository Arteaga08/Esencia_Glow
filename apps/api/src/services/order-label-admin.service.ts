import { OrderAction, OrderStatus, ShippingLabelStatus } from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import { AppError } from "../utils/app-error.js";
import { recordAudit } from "./audit.service.js";
import { triggerLabelGeneration } from "./order-label-trigger.js";

/**
 * Reintento MANUAL de la guía de envío desde el panel (Milestone 1.9): la
 * única salida de `needs_review` (o de un `failed` que el admin no quiere
 * esperar). El admin ya confirmó en el panel del proveedor que no hay una guía
 * duplicada — lo dice el correo de alerta y el copy del panel.
 *
 * Dos modos, según si el proveedor YA aceptó la compra:
 * - sin `providerShipmentId` (nada se cobró que sepamos): vuelve a `pending`
 *   con los intentos en 0 -> se COMPRA;
 * - con `providerShipmentId` (el proveedor ya cobró y solo faltaba terminar):
 *   vuelve a `processing` -> solo se CONSULTA, jamás se recompra. Se
 *   reinicia su reloj para que el barrido no la devuelva a revisión al
 *   instante.
 *
 * Ambos son un CAS sobre el estado de la guía: dos reintentos simultáneos no
 * encolan dos veces.
 */

interface RetryOrderLabelInput {
  orderId: string;
  adminId: string;
}

const RETRYABLE_LABEL_STATUSES = [ShippingLabelStatus.NEEDS_REVIEW, ShippingLabelStatus.FAILED];
const ACTIVE_ORDER_STATUSES = [OrderStatus.PAID, OrderStatus.PROCESSING];

async function retryOrderLabel(input: RetryOrderLabelInput): Promise<void> {
  const now = new Date();
  const retryable = {
    _id: input.orderId,
    status: { $in: ACTIVE_ORDER_STATUSES },
    "label.status": { $in: RETRYABLE_LABEL_STATUSES },
  };

  const requeued = await Order.findOneAndUpdate(
    { ...retryable, "label.providerShipmentId": { $exists: false } },
    {
      $set: { "label.status": ShippingLabelStatus.PENDING, "label.attempts": 0, "label.nextAttemptAt": now },
      $unset: { "label.adminAlertedAt": "", "label.requestedAt": "" },
    },
  );

  let mode: "purchase" | "poll" = "purchase";
  if (!requeued) {
    const repolling = await Order.findOneAndUpdate(
      { ...retryable, "label.providerShipmentId": { $exists: true } },
      {
        $set: { "label.status": ShippingLabelStatus.PROCESSING, "label.requestedAt": now },
        $unset: { "label.adminAlertedAt": "", "label.nextAttemptAt": "" },
      },
    );
    if (!repolling) {
      const exists = await Order.exists({ _id: input.orderId });
      if (!exists) throw new AppError("Pedido no encontrado.", 404);
      throw new AppError("La guía de este pedido no está en un estado que permita reintentar.", 409);
    }
    mode = "poll";
  }

  await recordAudit({
    action: OrderAction.LABEL_RETRY_REQUESTED,
    actorId: input.adminId,
    targetId: input.orderId,
    metadata: { mode },
  });

  // Solo la compra se dispara ya; consultar lo hace el siguiente tick del job.
  if (mode === "purchase") triggerLabelGeneration(input.orderId);
}

export { retryOrderLabel };
export type { RetryOrderLabelInput };
