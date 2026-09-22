import { DisputeStatus, OrderAction, OrderStatus } from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import { AppError } from "../utils/app-error.js";
import { recordAudit } from "./audit.service.js";
import { assertTransition } from "./order-state.js";
import { isDisputeBlockedTransition } from "./order-dispute.service.js";
import { claimStatusTransition, type ShipmentInput } from "./order-status-claim.js";

/**
 * Transiciones de estado disparadas por el SISTEMA (Milestone 1.9): la guía
 * lista mueve `paid -> processing`, el tracking del proveedor mueve
 * `processing -> shipped -> delivered`. Mismo claim atómico que el panel
 * admin (`order-status-claim.ts`), pero a diferencia de él NO lanza cuando
 * pierde una carrera legítima: un webhook de tracking que llega cuando el
 * admin ya movió la orden a mano no es un error, es un no-op — lanzar haría
 * que el proveedor reintente para siempre el mismo evento.
 *
 * Lo único que SÍ lanza son errores de programación: una arista que el
 * sistema no puede tomar (409), `shipped` sin guía (400), orden inexistente
 * (404).
 */

type SystemTransitionOutcome = "applied" | "skipped_state" | "skipped_dispute";

interface ApplySystemOrderTransitionInput {
  orderId: string;
  /** Estado en el que el llamador espera encontrar la orden. Si ya no está
   * ahí (otro escritor la movió) => `skipped_state`. */
  from: OrderStatus;
  to: OrderStatus;
  reason?: string;
  /** Requerido SOLO para `processing -> shipped`. */
  shipment?: ShipmentInput;
}

interface ApplySystemOrderTransitionResult {
  outcome: SystemTransitionOutcome;
}

async function applySystemOrderTransition(
  input: ApplySystemOrderTransitionInput,
): Promise<ApplySystemOrderTransitionResult> {
  assertTransition(input.from, input.to, "system");
  if (input.to === OrderStatus.SHIPPED && !input.shipment) {
    throw new AppError("Debes indicar la guía (paquetería y número de rastreo) al marcar como enviado.", 400);
  }

  const current = await Order.findById(input.orderId).select("status disputeStatus").lean();
  if (!current) throw new AppError("Pedido no encontrado.", 404);
  if (current.status !== input.from) return { outcome: "skipped_state" };

  // Un contracargo abierto bloquea DESPACHAR mercancía (`disputeClaimFilter`
  // lo exige también dentro del claim, así que no hay ventana de carrera); el
  // sistema simplemente no avanza y deja la orden donde está para el admin.
  if (isDisputeBlockedTransition(input.from, input.to) && current.disputeStatus === DisputeStatus.OPEN) {
    return { outcome: "skipped_dispute" };
  }

  const claimed = await claimStatusTransition({
    orderId: input.orderId,
    fromStatus: input.from,
    targetStatus: input.to,
    actor: { type: "system" },
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.shipment ? { shipment: input.shipment } : {}),
  });

  if (!claimed) {
    // El claim perdió: o se movió el estado, o se abrió un contracargo justo
    // en la ventana. Se relee para clasificar correctamente.
    const reread = await Order.findById(input.orderId).select("status disputeStatus").lean();
    if (reread && reread.status === input.from && reread.disputeStatus === DisputeStatus.OPEN) {
      return { outcome: "skipped_dispute" };
    }
    return { outcome: "skipped_state" };
  }

  await recordAudit({
    action: OrderAction.ORDER_STATUS_CHANGED,
    targetId: claimed._id,
    metadata: { from: input.from, to: input.to, actor: "system" },
  });
  if (input.to === OrderStatus.SHIPPED) {
    await recordAudit({ action: OrderAction.ORDER_SHIPMENT_UPDATED, targetId: claimed._id, metadata: { actor: "system" } });
  }

  return { outcome: "applied" };
}

export { applySystemOrderTransition };
export type { ApplySystemOrderTransitionInput, ApplySystemOrderTransitionResult, SystemTransitionOutcome };
