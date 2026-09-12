import { DisputeStatus, OrderAction, type OrderStatus } from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import { AppError } from "../utils/app-error.js";
import { recordAudit } from "./audit.service.js";

/**
 * Traduce `charge.dispute.created`/`.closed` a `disputeStatus` (§6 del plan
 * de 1.6.3). Un contracargo vive en la orden, no en `payment` — es un
 * evento del ciclo de vida de la venta, no un atributo del cobro (ver
 * order.model.ts). **Nunca** toca `status` ni el inventario: perder un
 * contracargo NO es `refunded` — el dinero se fue por la vía de la
 * disputa, no por un reembolso nuestro.
 *
 * Guard de estado terminal (BACKEND_SECURITY_GUIDELINES.md §"Acciones
 * sobre recursos con estado"): `won`/`lost`/`withdrawn` son terminales —
 * un `dispute.opened` que llega DESPUÉS (Stripe no garantiza el orden de
 * entrega de webhooks) no reabre una disputa ya cerrada.
 */
const TERMINAL_DISPUTE_STATUSES: readonly DisputeStatus[] = [
  DisputeStatus.WON,
  DisputeStatus.LOST,
  DisputeStatus.WITHDRAWN,
];

/** `charge.dispute.created` -> `open`. Idempotente: una reentrega o una
 * segunda disputa sobre la misma orden que ya está `open` no vuelve a
 * auditar (compara el documento ANTES del update, `{new: false}`). */
async function openDispute(orderId: string): Promise<void> {
  const before = await Order.findOneAndUpdate(
    { _id: orderId, disputeStatus: { $nin: TERMINAL_DISPUTE_STATUSES } },
    [{ $set: { disputeStatus: DisputeStatus.OPEN, disputedAt: { $ifNull: ["$disputedAt", new Date()] } } }],
    { new: false },
  );
  if (!before || before.disputeStatus === DisputeStatus.OPEN) return;
  await recordAudit({ action: OrderAction.ORDER_DISPUTED, targetId: orderId });
}

/** `charge.dispute.closed` -> `won`/`lost`/`withdrawn` (la traducción del
 * `status` crudo de Stripe vive en stripe-webhook-translator.ts). Sobre una
 * disputa YA terminal (guard), no-op — un desenlace no se pisa a sí mismo. */
async function closeDispute(orderId: string, outcome: DisputeStatus): Promise<void> {
  const before = await Order.findOneAndUpdate(
    { _id: orderId, disputeStatus: { $nin: TERMINAL_DISPUTE_STATUSES } },
    [{ $set: { disputeStatus: outcome, disputedAt: { $ifNull: ["$disputedAt", new Date()] } } }],
    { new: false },
  );
  if (!before) return;
  await recordAudit({ action: OrderAction.ORDER_DISPUTE_CLOSED, targetId: orderId, metadata: { outcome } });
}

/** Transiciones que un contracargo abierto bloquea (§6 del plan): no
 * despachar mercancía bajo disputa. `paid -> refunded`/`processing ->
 * refunded` NO están aquí a propósito — un reembolso decidido por un admin
 * humano (que ya vio la disputa en el panel) no debe quedar atrapado por
 * este guard. */
const DISPUTE_BLOCKED_TRANSITIONS = new Set<string>(["paid->processing", "processing->shipped"]);

function isDisputeBlockedTransition(from: OrderStatus, to: OrderStatus): boolean {
  return DISPUTE_BLOCKED_TRANSITIONS.has(`${from}->${to}`);
}

/** Guard de lectura, para fallar rápido con el mensaje correcto ANTES de
 * intentar el claim — `order-admin-status.service.ts` también mete este
 * mismo criterio en el FILTRO del `findOneAndUpdate` (vía
 * `disputeClaimFilter`), así que una disputa que se abre justo entre esta
 * lectura y esa escritura igual queda bloqueada, solo que con el mensaje
 * genérico de conflicto de concurrencia en vez de este. */
function assertNoOpenDispute(disputeStatus: DisputeStatus | undefined, from: OrderStatus, to: OrderStatus): void {
  if (isDisputeBlockedTransition(from, to) && disputeStatus === DisputeStatus.OPEN) {
    throw new AppError("El pedido tiene un contracargo abierto.", 409);
  }
}

/** Fragmento de filtro para el `findOneAndUpdate` que hace el claim de la
 * transición: en las dos transiciones que el guard bloquea, exige además
 * que no haya un contracargo abierto — así el claim mismo es la barrera
 * atómica, no solo la lectura previa. */
function disputeClaimFilter(from: OrderStatus, to: OrderStatus): Record<string, unknown> {
  return isDisputeBlockedTransition(from, to) ? { disputeStatus: { $ne: DisputeStatus.OPEN } } : {};
}

export { openDispute, closeDispute, assertNoOpenDispute, disputeClaimFilter, isDisputeBlockedTransition };
