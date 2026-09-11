import { createHash } from "node:crypto";
import { Types, type ClientSession } from "mongoose";
import {
  CATALOG_CURRENCY,
  InventoryAction,
  MAX_STATUS_HISTORY,
  OrderAction,
  OrderPriority,
  OrderStatus,
  PaymentState,
} from "@esencia-glow/shared";
import type { CartLineInput, ListQuery, PaginationMeta } from "@esencia-glow/shared";
import { Order, type OrderDocument } from "../models/order.model.js";
import type { ShippingAddressAttrs } from "../models/shipping-address.schema.js";
import type { OrderLineAttrs } from "../models/order-line.schema.js";
import type { ParcelAttrs } from "../models/parcel.schema.js";
import { AppError } from "../utils/app-error.js";
import { buildMeta } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import { withTransaction } from "../utils/with-transaction.js";
import { getSettings } from "./settings.service.js";
import { resolveCartLines, type ResolvedLine } from "./cart-resolution.service.js";
import { computeCartFingerprint, normalizeCartLines } from "./cart-fingerprint.js";
import { resolveUsableRate, type UsableRate } from "./shipping-quote.service.js";
import { reserveStock, releaseReservationDetailed, auditReleaseMismatches } from "./stock-reservation.service.js";
import { computeOrderTotals } from "./order-totals.js";
import { generateOrderNumber } from "./order-number.js";
import { assertTransition } from "./order-state.js";
import { recordAudit } from "./audit.service.js";
import type { LeanOrder } from "./order-dto.js";

/**
 * `createOrder` — la transacción grande del checkout (ver plan de 1.5 §B-H):
 * cotización de envío + snapshot del carrito + reserva de stock + totales
 * del servidor + folio, todo en una sola transacción de Mongo, con
 * idempotencia por `{userId, idempotencyKey}` y control de "un solo
 * checkout pendiente por cliente".
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

interface CreateOrderInput {
  userId: string;
  lines: CartLineInput[];
  quoteId: string;
  rateId: string;
  termsAccepted: boolean;
  idempotencyKey: string;
}

interface CreateOrderResult {
  order: OrderDocument;
  replay: boolean;
}

/**
 * Señales internas — nunca cruzan fuera de `createOrder`. Cada una marca
 * QUÉ índice único de `Order` chocó, para que el caller decida el efecto
 * correcto (replay silencioso vs. 409) sin adivinar por el mensaje crudo de
 * Mongo. Lanzarlas (en vez de manejarlas inline) aborta limpiamente la
 * transacción de Mongo sin marcarla como transitoria — `session.withTransaction`
 * no la reintenta.
 */
class IdempotencyConflictSignal extends Error {}
class PendingOrderExistsSignal extends Error {}
class OrderNumberConflictSignal extends Error {}

interface MongoDuplicateKeyError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

function isDuplicateKeyError(error: unknown): error is MongoDuplicateKeyError {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

function keyPatternHas(error: MongoDuplicateKeyError, key: string): boolean {
  return !!error.keyPattern && key in error.keyPattern;
}

/**
 * Hash determinista del payload de checkout SIN la idempotency key (que
 * viaja aparte, en el header). Dos requests con la misma key pero distinto
 * carrito/cotización no pueden confundirse con un replay legítimo — ver
 * plan §C. Usa el MISMO `normalizeCartLines` que `cart-fingerprint.ts`
 * (fusiona líneas duplicadas por `itemType:itemId` antes de ordenar): sin
 * eso, dos payloads lógicamente idénticos con el mismo ítem repetido en
 * distinto orden relativo producirían hashes distintos y un replay legítimo
 * caería en el 409 de "clave ya usada para otro pedido".
 */
function computeRequestHash(input: Pick<CreateOrderInput, "lines" | "quoteId" | "rateId" | "termsAccepted">): string {
  const normalizedLines = normalizeCartLines(input.lines);
  const canonical = JSON.stringify({
    lines: normalizedLines,
    quoteId: input.quoteId,
    rateId: input.rateId,
    termsAccepted: input.termsAccepted,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function toPlainShippingAddress(destination: ShippingAddressAttrs): ShippingAddressAttrs {
  return {
    fullName: destination.fullName,
    phone: destination.phone,
    street: destination.street,
    exteriorNumber: destination.exteriorNumber,
    interiorNumber: destination.interiorNumber,
    neighborhood: destination.neighborhood,
    city: destination.city,
    state: destination.state,
    postalCode: destination.postalCode,
    references: destination.references,
  };
}

function toPlainParcel(parcel: ParcelAttrs): ParcelAttrs {
  return {
    weightGrams: parcel.weightGrams,
    lengthCm: parcel.lengthCm,
    widthCm: parcel.widthCm,
    heightCm: parcel.heightCm,
    volumetricWeightGrams: parcel.volumetricWeightGrams,
  };
}

function toOrderLine(line: ResolvedLine): OrderLineAttrs {
  return {
    itemType: line.itemType,
    itemId: new Types.ObjectId(line.itemId),
    sku: line.sku,
    name: line.name,
    variantName: line.variantName,
    attributes: line.attributes,
    unitPriceCents: line.unitPriceCents,
    quantity: line.quantity,
    lineTotalCents: line.lineTotalCents,
    components: line.components?.map((component) => ({
      productId: component.productId,
      variantId: component.variantId,
      sku: component.sku,
      name: component.name,
      variantName: component.variantName,
      quantity: component.quantity,
      catalogUnitPriceCents: component.catalogUnitPriceCents,
    })),
  };
}

async function createOrderCore(
  input: CreateOrderInput & { requestHash: string },
  orderId: Types.ObjectId,
  settings: Awaited<ReturnType<typeof getSettings>>,
  session: ClientSession,
): Promise<OrderDocument> {
  const cartFingerprint = computeCartFingerprint(input.lines);

  const { quote, rate }: UsableRate = await resolveUsableRate(
    { quoteId: input.quoteId, rateId: input.rateId, userId: input.userId, cartFingerprint },
    session,
  );

  const resolvedLines = await resolveCartLines(input.lines, session);

  const reservationLines = resolvedLines.flatMap((line) => line.reservationLines);
  const sourceBundles = resolvedLines
    .map((line) => line.sourceBundle)
    .filter((sourceBundle): sourceBundle is NonNullable<ResolvedLine["sourceBundle"]> => !!sourceBundle);

  const reservation = await reserveStock(
    {
      cartRef: orderId.toString(),
      userId: input.userId,
      lines: reservationLines,
      ttlMinutes: settings.inventory.reservationTtlMinutes,
      sourceBundles: sourceBundles.length > 0 ? sourceBundles : undefined,
    },
    session,
  );

  const totals = computeOrderTotals({
    lineTotalsCents: resolvedLines.map((line) => line.lineTotalCents),
    chosenRateAmountCents: rate.amountCents,
    cheapestRateAmountCents: quote.cheapestAmountCents,
    taxRateBps: settings.commerce.taxRateBps,
    freeShippingThresholdCents: settings.commerce.freeShippingThresholdCents,
  });

  const now = new Date();
  const userObjectId = new Types.ObjectId(input.userId);
  const orderNumber = generateOrderNumber();

  try {
    const [order] = await Order.create(
      [
        {
          _id: orderId,
          orderNumber,
          userId: userObjectId,
          status: OrderStatus.PENDING,
          lines: resolvedLines.map(toOrderLine),
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          taxCents: totals.taxCents,
          taxRateBps: totals.taxRateBps,
          shippingCents: totals.shippingCents,
          totalCents: totals.totalCents,
          currency: CATALOG_CURRENCY,
          payment: { provider: "stripe", state: PaymentState.PENDING, captureMethod: "automatic" },
          shippingAddress: toPlainShippingAddress(quote.destination),
          shippingSelection: {
            rateId: rate.rateId,
            carrier: rate.carrier,
            service: rate.service,
            amountCents: rate.amountCents,
            estimatedDays: rate.estimatedDays,
          },
          parcel: toPlainParcel(quote.parcel),
          termsAcceptedAt: now,
          idempotencyKey: input.idempotencyKey,
          requestHash: input.requestHash,
          reservationId: reservation._id,
          expiresAt: reservation.expiresAt,
          statusHistory: [{ status: OrderStatus.PENDING, at: now, actorType: "user", actorId: userObjectId }],
          priority: OrderPriority.NORMAL,
          internalNotes: [],
          inventoryIncident: false,
        },
      ],
      { session },
    );
    return order as OrderDocument;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    if (keyPatternHas(error, "orderNumber")) throw new OrderNumberConflictSignal();
    if (keyPatternHas(error, "idempotencyKey")) throw new IdempotencyConflictSignal();
    // { userId: 1 } parcial por status "pending" — verificado explícito
    // (no un `else` ciego): si algún día se agrega otro índice único que
    // `Order.create` pueda violar, esto debe reventar como error crudo en
    // vez de mentir con un 409 "ya tienes un pedido pendiente".
    if (keyPatternHas(error, "userId")) throw new PendingOrderExistsSignal();
    throw error;
  }
}

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

const MY_ORDER_SORT_FIELDS = ["createdAt", "totalCents", "status"] as const;

interface ListMyOrdersInput extends ListQuery {
  userId: string;
}

/** Lectura del cliente — SIEMPRE filtrada por `userId` en la query, nunca
 * un check posterior (ver AppError de anti-IDOR en `getMyOrder`). */
async function listMyOrders(input: ListMyOrdersInput): Promise<{ rows: LeanOrder[]; meta: PaginationMeta }> {
  const filter = { userId: new Types.ObjectId(input.userId) };

  const [rows, total] = await Promise.all([
    Order.find(filter)
      .sort(resolveSort(input.sort, MY_ORDER_SORT_FIELDS, "createdAt"))
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean<LeanOrder[]>(),
    Order.countDocuments(filter),
  ]);

  return { rows, meta: buildMeta(total, input) };
}

/**
 * Anti-IDOR: la propiedad viaja DENTRO del filtro (`{_id, userId}`), nunca
 * como un check después de cargar por `_id` a secas. Un miss (no existe O
 * es de otro usuario) responde 404 — nunca 403, que confirmaría que la
 * orden existe (ver plan de 1.5 §H).
 */
async function getMyOrder(orderId: string, userId: string): Promise<LeanOrder> {
  const order = await Order.findOne({ _id: orderId, userId }).lean<LeanOrder>();
  if (!order) throw new AppError("Pedido no encontrado.", 404);
  return order;
}

/**
 * Cancela una orden propia. Solo existe desde `pending` (ver order-state.ts
 * §D) — el claim de estado (`findOneAndUpdate` con `status: pending` en el
 * filtro) es la primera escritura de la transacción, así que nunca compite
 * con `cancelExpiredOrders` (1.9) por la misma orden sin que una de las dos
 * pierda limpio.
 */
async function cancelMyOrder(orderId: string, userId: string): Promise<LeanOrder> {
  assertTransition(OrderStatus.PENDING, OrderStatus.CANCELLED, "customer");

  const { order: claimed, releaseResult } = await withTransaction(async (session) => {
    const now = new Date();
    const claimedOrder = await Order.findOneAndUpdate(
      { _id: orderId, userId, status: OrderStatus.PENDING },
      {
        $set: { status: OrderStatus.CANCELLED },
        $push: {
          statusHistory: {
            $each: [{ status: OrderStatus.CANCELLED, at: now, actorType: "user", actorId: new Types.ObjectId(userId) }],
            $slice: -MAX_STATUS_HISTORY,
          },
        },
      },
      { new: true, session },
    ).lean<LeanOrder>();

    if (!claimedOrder) {
      const existing = await Order.findOne({ _id: orderId, userId }).session(session).lean<LeanOrder>();
      if (!existing) throw new AppError("Pedido no encontrado.", 404);
      throw new AppError("Solo se puede cancelar un pedido pendiente de pago.", 409);
    }

    const release = await releaseReservationDetailed(claimedOrder.reservationId.toString(), session);
    return { order: claimedOrder, releaseResult: release };
  });

  // Efectos no-DB DESPUÉS del commit — mismo contrato que
  // stock-reservation.service.ts: el DUEÑO de la transacción audita.
  if (releaseResult.inconsistentVariants.length > 0) {
    await auditReleaseMismatches(claimed.reservationId.toString(), releaseResult.inconsistentVariants);
  }
  await recordAudit({ action: OrderAction.ORDER_CANCELLED, actorId: userId, targetId: claimed._id });

  return claimed;
}

export { createOrder, computeRequestHash, listMyOrders, getMyOrder, cancelMyOrder };
export type { CreateOrderInput, CreateOrderResult, ListMyOrdersInput };
