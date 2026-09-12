import type { ClientSession, Types } from "mongoose";
import { ReservationStatus } from "@esencia-glow/shared";
import { Inventory } from "../models/inventory.model.js";
import { StockReservation, type StockReservationDocument } from "../models/stock-reservation.model.js";
import { AppError } from "../utils/app-error.js";
import { withTransaction } from "../utils/with-transaction.js";

/**
 * Devuelve a `Inventory.onHand` las unidades de una reserva `committed`
 * cuando un reembolso confirma que la orden NO se va a enviar (§3 del plan
 * de 1.6.3): a diferencia de `releaseReservation` (que suelta una reserva
 * `active` nunca vendida), aquí el dinero YA se cobró — el commit de
 * 1.4/1.5 ya restó `reserved` al comprometer, así que restockear es un
 * `$inc onHand` puro, SIN tocar `reserved` (ver stock-reservation.model.ts,
 * `commitReservationCore`: comprometer decrementa `onHand` y `reserved`
 * juntos; devolver solo debe deshacer `onHand`).
 *
 * Archivo aparte de `stock-reservation.service.ts` (444 líneas, ya en el
 * tope) — mismo criterio que separó `card-payment-attempts.service.ts` de
 * `order-closing.service.ts`.
 */

interface RestockVariantResult {
  variantId: Types.ObjectId;
  sku: string;
}

interface RestockResult {
  reservation: StockReservationDocument;
  /** true SOLO si ESTA llamada hizo el restock (idempotente: una reserva ya
   * restockeada, o que nunca llegó a `committed` — p. ej. un incidente de
   * inventario que la dejó `released` — devuelve `false` sin tocar nada). */
  restocked: boolean;
  /** Variantes cuya fila de `Inventory` ya no existe. NO aborta el restock:
   * el dinero ya se devolvió por Stripe, así que negarse a marcar la
   * reserva como restockeada dejaría reintentando para siempre algo que un
   * admin debe resolver a mano de todos modos. */
  missingVariants: RestockVariantResult[];
}

async function restockCommittedReservationCore(
  reservationId: string,
  session: ClientSession,
): Promise<RestockResult> {
  const claimed = await StockReservation.findOneAndUpdate(
    { _id: reservationId, status: ReservationStatus.COMMITTED, restockedAt: { $exists: false } },
    { $set: { restockedAt: new Date() } },
    { new: true, session },
  );

  if (!claimed) {
    const existing = await StockReservation.findById(reservationId).session(session);
    if (!existing) throw new AppError("Reserva no encontrada", 404);
    // `active`/`released` (incidente de inventario, nunca comprometida) o
    // `committed` ya restockeada antes: en cualquier caso, nada que hacer.
    return { reservation: existing, restocked: false, missingVariants: [] };
  }

  const missingVariants: RestockVariantResult[] = [];
  for (const line of claimed.lines) {
    const updated = await Inventory.findOneAndUpdate(
      { variantId: line.variantId },
      { $inc: { onHand: line.quantity } },
      { new: true, session },
    );
    if (!updated) {
      missingVariants.push({ variantId: line.variantId, sku: line.sku });
    }
  }

  return { reservation: claimed, restocked: true, missingVariants };
}

/**
 * Wrapper delgado (mismo patrón que `commitReservationDetailed`): sin
 * `session`, abre su propia transacción — el uso standalone de esta
 * suite. Compuesta dentro de `order-refund-settlement.service.ts`, recibe
 * la sesión ajena y no abre una segunda.
 */
async function restockCommittedReservation(
  reservationId: string,
  session?: ClientSession,
): Promise<RestockResult> {
  return withTransaction((s) => restockCommittedReservationCore(reservationId, s), session);
}

export { restockCommittedReservation };
export type { RestockResult, RestockVariantResult };
