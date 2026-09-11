import type { ClientSession } from "mongoose";
import { InventoryAction, MAX_STATUS_HISTORY, OrderAction, OrderStatus, PaymentState } from "@esencia-glow/shared";
import { Order, type OrderDocument } from "../models/order.model.js";
import type { StockReservationDocument } from "../models/stock-reservation.model.js";
import { AppError } from "../utils/app-error.js";
import { withTransaction } from "../utils/with-transaction.js";
import { commitReservationDetailed, auditCommitOnReleased } from "./stock-reservation.service.js";
import { assertTransition } from "./order-state.js";
import { recordAudit } from "./audit.service.js";

/**
 * `markOrderPaid` — gancho de 1.6 (webhook de Stripe). Ningún endpoint
 * admin puede mover una orden a `paid`: `paid` lo determina SOLO el
 * webhook (ver plan de 1.5 §E).
 */

type MarkOrderPaidOutcome = "paid" | "already_paid" | "inventory_incident";

interface MarkOrderPaidInput {
  orderId: string;
  intentId?: string;
  card?: { brand: string; last4: string };
}

interface MarkOrderPaidResult {
  order: OrderDocument;
  outcome: MarkOrderPaidOutcome;
  /**
   * Presente SOLO cuando `outcome === "inventory_incident"`. Si esta llamada
   * es dueña de su transacción (sin `session` externa), YA audita el
   * incidente antes de devolver — este campo es forense/informativo. Si se
   * llamó con una `session` ajena (composición de 1.6), el CALLER es el
   * dueño de la transacción y debe auditar `auditCommitOnReleased(reservation)`
   * + `OrderAction.ORDER_STOCK_INCIDENT` él mismo DESPUÉS de su propio
   * commit — mismo contrato que `CommitResult`/`ReleaseResult` en
   * stock-reservation.service.ts. Omitir esto perdería el rastro de
   * auditoría de un incidente de inventario real cuando 1.6 componga esta
   * llamada dentro de su propia transacción.
   */
  releasedReservation?: StockReservationDocument;
}

type MarkOrderPaidCoreResult = MarkOrderPaidResult;

/**
 * El claim de estado (`pending -> paid`) es la PRIMERA escritura de la
 * transacción — el documento `Order` es el punto de serialización (ver
 * plan §D regla 2): imposible que esto y una cancelación concurrente dejen
 * la orden `paid` con la reserva liberada SIN marcar el incidente, o
 * `cancelled` con el stock ya descontado.
 */
async function markOrderPaidCore(
  input: MarkOrderPaidInput,
  session: ClientSession,
): Promise<MarkOrderPaidCoreResult> {
  const now = new Date();

  const claimed = await Order.findOneAndUpdate(
    { _id: input.orderId, status: OrderStatus.PENDING },
    {
      $set: {
        status: OrderStatus.PAID,
        "payment.state": PaymentState.SUCCEEDED,
        "payment.capturedAt": now,
        ...(input.intentId ? { "payment.intentId": input.intentId } : {}),
        ...(input.card ? { "payment.card": input.card } : {}),
      },
      $push: {
        statusHistory: {
          $each: [{ status: OrderStatus.PAID, at: now, actorType: "system" }],
          $slice: -MAX_STATUS_HISTORY,
        },
      },
    },
    { new: true, session },
  );

  if (!claimed) {
    const existing = await Order.findById(input.orderId).session(session);
    if (!existing) throw new AppError("Pedido no encontrado.", 404);
    if (existing.status === OrderStatus.PAID) {
      // Reintento del webhook: éxito silencioso, sin volver a tocar nada.
      return { order: existing, outcome: "already_paid" };
    }
    throw new AppError(`No se puede marcar como pagado un pedido en estado "${existing.status}".`, 409);
  }

  const commitResult = await commitReservationDetailed(claimed.reservationId.toString(), session);

  if (commitResult.outcome === "already_released") {
    // La reserva ya se liberó (p. ej. expiró o se canceló) pero el dinero
    // YA es real: nunca se finge el commit ni se regresa a `pending` (el
    // webhook reintentaría para siempre). Se marca para revisión humana.
    const incidentOrder = await Order.findOneAndUpdate(
      { _id: claimed._id },
      { $set: { inventoryIncident: true, adminAlertedAt: now } },
      { new: true, session },
    );
    return {
      order: incidentOrder!,
      outcome: "inventory_incident",
      releasedReservation: commitResult.reservation,
    };
  }

  return { order: claimed, outcome: "paid" };
}

async function markOrderPaid(input: MarkOrderPaidInput, session?: ClientSession): Promise<MarkOrderPaidResult> {
  assertTransition(OrderStatus.PENDING, OrderStatus.PAID, "system");

  const result = await withTransaction((s) => markOrderPaidCore(input, s), session);

  // Efectos no-DB DESPUÉS del commit, y SOLO cuando esta llamada es dueña
  // de la transacción — mismo contrato que stock-reservation.service.ts.
  if (!session && result.outcome !== "already_paid") {
    if (result.releasedReservation) {
      await auditCommitOnReleased(result.releasedReservation);
      await recordAudit({
        action: OrderAction.ORDER_STOCK_INCIDENT,
        targetId: result.order._id,
        metadata: { orderNumber: result.order.orderNumber },
      });
    } else {
      // Emisor pendiente de 1.4 (declarado sin actor humano al que
      // atribuirlo); el webhook de pago SÍ tiene ese contexto. Solo en el
      // commit real — el outcome `inventory_incident` NO comete la reserva.
      await recordAudit({ action: InventoryAction.RESERVATION_COMMITTED, targetId: result.order.reservationId });
    }
    await recordAudit({
      action: OrderAction.ORDER_PAID,
      targetId: result.order._id,
      metadata: { orderNumber: result.order.orderNumber },
    });
  }

  return { order: result.order, outcome: result.outcome, releasedReservation: result.releasedReservation };
}

export { markOrderPaid };
export type { MarkOrderPaidInput, MarkOrderPaidResult, MarkOrderPaidOutcome };
