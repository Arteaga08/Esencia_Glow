import { Types, type ClientSession, type FilterQuery } from "mongoose";
import { InventoryAction, MAX_LINE_QUANTITY, ProductStatus, ReservationStatus } from "@esencia-glow/shared";
import type { ListQuery, PaginationMeta } from "@esencia-glow/shared";
import { Inventory } from "../models/inventory.model.js";
import { Product } from "../models/product.model.js";
import {
  StockReservation,
  type ReservationLineAttrs,
  type StockReservationAttrs,
  type StockReservationDocument,
} from "../models/stock-reservation.model.js";
import { AppError } from "../utils/app-error.js";
import { buildMeta } from "../utils/parse-list-query.js";
import { withTransaction } from "../utils/with-transaction.js";
import { recordAudit } from "./audit.service.js";
import { logger } from "../config/logger.js";
import type { LeanReservation } from "./inventory-dto.js";

const RESERVATION_SORT_FIELDS = ["createdAt", "expiresAt", "status"] as const;
const PURGE_GRACE_MS = 24 * 60 * 60 * 1000;

interface ReserveStockLineInput {
  variantId: string;
  quantity: number;
}

interface SourceBundleInput {
  bundleId: string;
  quantity: number;
}

interface ReserveStockInput {
  cartRef: string;
  userId?: string;
  lines: ReserveStockLineInput[];
  ttlMinutes: number;
  sourceBundles?: SourceBundleInput[];
}

interface ListReservationsInput extends ListQuery {
  status?: ReservationStatus;
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

function computePurgeAt(): Date {
  return new Date(Date.now() + PURGE_GRACE_MS);
}

/**
 * Deduplica líneas por `variantId` sumando cantidades, y las ordena por
 * `variantId` (orden canónico, hex string). No evita un conflicto de
 * escritura entre dos reservas concurrentes que compitan por variantes
 * distintas, pero convierte el patrón en first-writer-wins: la perdedora
 * choca siempre en el primer documento, en vez de que dos reservas se
 * aborten mutuamente por tomar las mismas variantes en orden opuesto.
 */
function normalizeLines(lines: ReserveStockLineInput[]): Map<string, number> {
  const merged = new Map<string, number>();
  for (const line of lines) {
    merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + line.quantity);
  }
  return new Map([...merged.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Ninguna variante inactiva ni de un producto archivado puede reservarse.
 * `Inventory` no denormaliza `isActive` (ese drift vendería lo despublicado),
 * así que esta lectura corre DENTRO de la misma transacción que hace la
 * reserva, en el mismo snapshot.
 */
async function assertVariantsAvailable(
  variantIds: string[],
  session: ClientSession,
): Promise<void> {
  const objectIds = variantIds.map((id) => new Types.ObjectId(id));
  const products = await Product.find({ "variants._id": { $in: objectIds }, status: ProductStatus.ACTIVE })
    .session(session)
    .lean();

  const activeVariantIds = new Set<string>();
  for (const product of products) {
    for (const variant of product.variants) {
      if (variant.isActive) activeVariantIds.add(variant._id.toString());
    }
  }

  const unavailable = variantIds.filter((id) => !activeVariantIds.has(id));
  if (unavailable.length > 0) {
    throw new AppError("Una o más variantes ya no están disponibles para la venta.", 409);
  }
}

/**
 * Única forma de reservar: la condición de disponibilidad y el `$inc` viajan
 * en el mismo `findOneAndUpdate` con `$expr`, línea por línea, dentro de una
 * transacción — si cualquier línea falla, Mongo revierte TODAS las
 * anteriores de esta misma llamada (nunca una reserva parcial).
 */
/**
 * Aplica MAX_LINE_QUANTITY sobre la cantidad YA fusionada por variante, no
 * por línea cruda: dos líneas de 60 para la misma variante burlarían un
 * límite de 99 comprobado antes de fusionar. Corre antes de abrir la
 * transacción — un valor inválido no amerita ni la sesión ni el round-trip.
 */
function assertLineQuantitiesWithinLimit(orderedLines: Map<string, number>): void {
  for (const quantity of orderedLines.values()) {
    if (quantity > MAX_LINE_QUANTITY) {
      throw new AppError(
        `No puedes reservar más de ${MAX_LINE_QUANTITY} unidades de una misma variante en una sola operación.`,
        400,
      );
    }
  }
}

async function reserveStock(input: ReserveStockInput): Promise<StockReservationDocument> {
  const orderedLines = normalizeLines(input.lines);
  assertLineQuantitiesWithinLimit(orderedLines);

  return withTransaction(async (session) => {
    await assertVariantsAvailable([...orderedLines.keys()], session);

    const reservationLines: ReservationLineAttrs[] = [];
    for (const [variantId, quantity] of orderedLines) {
      const updated = await Inventory.findOneAndUpdate(
        {
          variantId: new Types.ObjectId(variantId),
          $expr: { $gte: [{ $subtract: ["$onHand", "$reserved"] }, quantity] },
        },
        { $inc: { reserved: quantity } },
        { new: true, session },
      );
      if (!updated) {
        throw new AppError("Sin stock disponible", 409);
      }
      reservationLines.push({ variantId: updated.variantId, sku: updated.sku, quantity });
    }

    const expiresAt = new Date(Date.now() + input.ttlMinutes * 60_000);

    try {
      const [reservation] = await StockReservation.create(
        [
          {
            cartRef: input.cartRef,
            userId: input.userId ? new Types.ObjectId(input.userId) : undefined,
            lines: reservationLines,
            sourceBundles: input.sourceBundles?.map((bundle) => ({
              bundleId: new Types.ObjectId(bundle.bundleId),
              quantity: bundle.quantity,
            })),
            status: ReservationStatus.ACTIVE,
            expiresAt,
          },
        ],
        { session },
      );
      return reservation as StockReservationDocument;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AppError("Ya existe una reserva activa para este carrito.", 409);
      }
      throw error;
    }
  });
}

/**
 * El claim de estado (`active` -> `status`) es la PRIMERA escritura de la
 * transacción: si dos llamadas compiten por la misma reserva, la perdedora
 * conflictúa y reintenta viendo ya el estado terminal, sin llegar a tocar
 * `Inventory`. Un `null` no es un no-op silencioso: se relee para ramificar
 * (ver tabla de estados en el plan de 1.4).
 */
async function commitReservation(reservationId: string): Promise<StockReservationDocument> {
  return withTransaction(async (session) => {
    const claimed = await StockReservation.findOneAndUpdate(
      { _id: reservationId, status: ReservationStatus.ACTIVE },
      { $set: { status: ReservationStatus.COMMITTED, purgeAt: computePurgeAt() } },
      { new: true, session },
    );

    if (claimed) {
      for (const line of claimed.lines) {
        const updated = await Inventory.findOneAndUpdate(
          { variantId: line.variantId, reserved: { $gte: line.quantity } },
          { $inc: { onHand: -line.quantity, reserved: -line.quantity } },
          { new: true, session },
        );
        if (!updated) {
          throw new AppError(
            `Inventario inconsistente al comprometer la variante ${line.variantId.toString()}`,
            409,
          );
        }
      }
      return claimed;
    }

    const existing = await StockReservation.findById(reservationId).session(session);
    if (!existing) throw new AppError("Reserva no encontrada", 404);
    if (existing.status === ReservationStatus.COMMITTED) return existing;

    // existing.status === RELEASED: cobramos algo cuyo stock ya devolvimos.
    // No es un no-op — es un incidente que requiere revisión (1.5 lo conecta
    // a un flujo de reconciliación manual).
    logger.error(
      { reservationId },
      "Intento de comprometer una reserva ya liberada — el stock ya fue devuelto",
    );
    await recordAudit({
      action: InventoryAction.COMMIT_ON_RELEASED,
      targetId: existing._id,
      metadata: { cartRef: existing.cartRef },
    });
    throw new AppError(
      "Esta reserva ya fue liberada: el stock ya no está apartado.",
      409,
    );
  });
}

interface InconsistentVariant {
  variantId: Types.ObjectId;
  sku: string;
}

interface ReleaseResult {
  reservation: StockReservationDocument;
  /** true solo si ESTA llamada hizo la transición active -> released. El
   * barrendero (release-expired-reservations.ts) la usa para no contar dos
   * veces la misma reserva cuando dos ejecuciones concurrentes la alcanzan:
   * una transiciona, la otra encuentra el estado ya terminal. */
  transitioned: boolean;
  /** Variantes donde `Inventory.reserved` ya estaba por debajo de lo que esta
   * línea esperaba devolver. Se resuelve fuera de la transacción (ver
   * releaseReservationDetailed) — nunca dentro del callback, porque un
   * reintento por WriteConflict volvería a auditar el mismo incidente. */
  inconsistentVariants: InconsistentVariant[];
}

async function releaseReservation(reservationId: string): Promise<StockReservationDocument> {
  const { reservation } = await releaseReservationDetailed(reservationId);
  return reservation;
}

async function releaseReservationDetailed(reservationId: string): Promise<ReleaseResult> {
  const result = await withTransaction(async (session) => {
    const claimed = await StockReservation.findOneAndUpdate(
      { _id: reservationId, status: ReservationStatus.ACTIVE },
      { $set: { status: ReservationStatus.RELEASED, purgeAt: computePurgeAt() } },
      { new: true, session },
    );

    if (claimed) {
      // Local a ESTA invocación del callback: un reintento por WriteConflict
      // vuelve a empezar el `for` desde cero con un array fresco, así que
      // nunca se acumulan incidentes de intentos abortados.
      const inconsistentVariants: InconsistentVariant[] = [];

      for (const line of claimed.lines) {
        const updated = await Inventory.findOneAndUpdate(
          { variantId: line.variantId, reserved: { $gte: line.quantity } },
          { $inc: { reserved: -line.quantity } },
          { new: true, session },
        );
        if (!updated) {
          // Asimetría deliberada frente a commit: si no matchea, logueamos y
          // seguimos. La reserva YA quedó marcada `released` arriba; si
          // abortáramos aquí, quedaría irreleaseable para siempre y el cron
          // la reintentaría cada minuto sin poder nunca completar el release.
          logger.error(
            { reservationId, variantId: line.variantId.toString() },
            "No se pudo decrementar reserved al liberar — el inventario ya estaba por debajo de lo esperado",
          );
          inconsistentVariants.push({ variantId: line.variantId, sku: line.sku });
        }
      }
      return { reservation: claimed, transitioned: true, inconsistentVariants };
    }

    const existing = await StockReservation.findById(reservationId).session(session);
    if (!existing) throw new AppError("Reserva no encontrada", 404);
    if (existing.status === ReservationStatus.RELEASED) {
      return { reservation: existing, transitioned: false, inconsistentVariants: [] };
    }

    // existing.status === COMMITTED: no se puede devolver stock ya vendido.
    throw new AppError("Esta reserva ya fue comprometida: no se puede liberar.", 409);
  });

  // La auditoría corre DESPUÉS de que la transacción resolvió — nunca dentro
  // del callback (mismo motivo que arriba): así el registro refleja solo el
  // intento que de verdad ganó, nunca uno que Mongo abortó y reintentó.
  for (const variant of result.inconsistentVariants) {
    await recordAudit({
      action: InventoryAction.RELEASE_INVENTORY_MISMATCH,
      targetId: variant.variantId,
      metadata: { reservationId, sku: variant.sku },
    });
  }

  return result;
}

async function getReservation(reservationId: string): Promise<StockReservationDocument> {
  const reservation = await StockReservation.findById(reservationId);
  if (!reservation) throw new AppError("Reserva no encontrada", 404);
  return reservation;
}

async function listReservations(
  input: ListReservationsInput,
): Promise<{ rows: LeanReservation[]; meta: PaginationMeta }> {
  const filter: FilterQuery<StockReservationAttrs> = {};
  if (input.status) filter.status = input.status;

  const direction = input.sort.direction === "desc" ? -1 : 1;
  const field = RESERVATION_SORT_FIELDS.includes(
    input.sort.field as (typeof RESERVATION_SORT_FIELDS)[number],
  )
    ? input.sort.field
    : "createdAt";

  const [rows, total] = await Promise.all([
    StockReservation.find(filter)
      .sort({ [field]: direction, _id: direction })
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean<LeanReservation[]>(),
    StockReservation.countDocuments(filter),
  ]);

  return { rows, meta: buildMeta(total, input) };
}

export {
  reserveStock,
  commitReservation,
  releaseReservation,
  releaseReservationDetailed,
  getReservation,
  listReservations,
};
export type { ReserveStockInput, ReserveStockLineInput, ListReservationsInput, ReleaseResult };
