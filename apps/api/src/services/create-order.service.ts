import { Types } from "mongoose";
import { InventoryAction, OrderAction, OrderStatus } from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import { AppError } from "../utils/app-error.js";
import { withTransaction } from "../utils/with-transaction.js";
import { getSettings } from "./settings.service.js";
import { recordAudit } from "./audit.service.js";
import {
  IdempotencyConflictSignal,
  PendingOrderExistsSignal,
  OrderNumberConflictSignal,
  computeRequestHash,
} from "./create-order-mappers.js";
import type { CreateOrderInput, CreateOrderResult } from "./create-order-mappers.js";
import { createOrderCore } from "./create-order-core.js";

/**
 * `createOrder` — punto de entrada público del checkout (ver plan de 1.5
 * §B-H y plan de 1.6 §B-D): retry loop de folio + manejo de conflictos de
 * idempotencia/checkout pendiente + auditoría post-commit. El cuerpo de la
 * transacción vive en create-order-core.ts y los helpers puros en
 * create-order-mappers.ts — split por el tope de 250 líneas por archivo.
 */

const CHECKOUT_TRANSACTION_MAX_ATTEMPTS = 10;
/**
 * Astronómicamente improbable (32^8 combinaciones), pero el índice único de
 * `orderNumber` puede chocar — un reintento completo (nueva `orderId`,
 * nueva transacción, que re-hace cotización+carrito+reserva desde cero)
 * basta. Bajo a propósito: si la probabilidad de UNA colisión ya es
 * astronómica, exigir varios reintentos completos sería defensivo muy por
 * encima de esa probabilidad, e infla el peor caso de latencia del
 * checkout sin beneficio real — peor caso teórico:
 * `ORDER_NUMBER_OUTER_ATTEMPTS × CHECKOUT_TRANSACTION_MAX_ATTEMPTS` = 30
 * ejecuciones completas de `createOrderCore`.
 */
const ORDER_NUMBER_OUTER_ATTEMPTS = 3;

async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  if (!input.termsAccepted) {
    throw new AppError("Debes aceptar los términos y condiciones.", 400);
  }

  const settings = await getSettings();
  const requestHash = computeRequestHash(input);
  const coreInput = { ...input, requestHash };

  let lastOrderNumberConflict: unknown;
  for (let attempt = 0; attempt < ORDER_NUMBER_OUTER_ATTEMPTS; attempt++) {
    const orderId = new Types.ObjectId();
    try {
      const order = await withTransaction(
        (session) => createOrderCore(coreInput, orderId, settings, session),
        undefined,
        CHECKOUT_TRANSACTION_MAX_ATTEMPTS,
      );
      // Efecto no-DB DESPUÉS del commit, nunca dentro del closure — mismo
      // contrato que auditCommitOnReleased/auditReleaseMismatches en
      // stock-reservation.service.ts.
      await recordAudit({
        action: OrderAction.ORDER_CREATED,
        actorId: input.userId,
        targetId: order._id,
        metadata: { orderNumber: order.orderNumber, totalCents: order.totalCents },
      });
      // Emisor pendiente de 1.4 (declarado sin actor humano al que
      // atribuirlo); el checkout SÍ tiene ese contexto.
      await recordAudit({
        action: InventoryAction.RESERVATION_CREATED,
        actorId: input.userId,
        targetId: order.reservationId,
      });
      return { order, replay: false };
    } catch (error) {
      if (error instanceof OrderNumberConflictSignal) {
        lastOrderNumberConflict = error;
        continue;
      }
      if (error instanceof IdempotencyConflictSignal) {
        const existing = await Order.findOne({ userId: input.userId, idempotencyKey: input.idempotencyKey });
        if (existing && existing.requestHash === requestHash) {
          return { order: existing, replay: true };
        }
        throw new AppError("Esa clave ya se usó para otro pedido.", 409);
      }
      if (error instanceof PendingOrderExistsSignal) {
        const existing = await Order.findOne({ userId: input.userId, status: OrderStatus.PENDING });
        throw new AppError(
          "Ya tienes un pedido pendiente de pago.",
          409,
          existing ? { orderId: existing._id.toString() } : undefined,
        );
      }
      throw error;
    }
  }

  throw lastOrderNumberConflict !== undefined
    ? new AppError("No se pudo generar un folio único, intenta de nuevo.", 409)
    : new AppError("No se pudo crear la orden, intenta de nuevo.", 500);
}


export { createOrder };
export type { CreateOrderInput, CreateOrderResult };
