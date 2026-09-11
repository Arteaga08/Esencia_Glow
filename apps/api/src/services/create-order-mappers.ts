import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { OXXO_MAX_AMOUNT_CENTS, OXXO_MIN_AMOUNT_CENTS, type CartLineInput, type PaymentMethod } from "@esencia-glow/shared";
import type { ShippingAddressAttrs } from "../models/shipping-address.schema.js";
import type { OrderLineAttrs } from "../models/order-line.schema.js";
import type { ParcelAttrs } from "../models/parcel.schema.js";
import { AppError } from "../utils/app-error.js";
import { normalizeCartLines } from "./cart-fingerprint.js";
import type { ResolvedLine } from "./cart-resolution.service.js";
import type { OrderDocument } from "../models/order.model.js";

/**
 * Helpers puros de `create-order.service.ts` — separados por el tope de
 * 250 líneas por archivo del repo (Milestone 1.6, mismo criterio que ya
 * aplicaba `order-admin-status.service.ts`/`order-admin-fields.service.ts`
 * en 1.5).
 */

interface CreateOrderInput {
  userId: string;
  lines: CartLineInput[];
  quoteId: string;
  rateId: string;
  paymentMethod: PaymentMethod;
  termsAccepted: boolean;
  idempotencyKey: string;
}

interface CreateOrderResult {
  order: OrderDocument;
  replay: boolean;
}

interface CreateOrderHashInput {
  lines: CartLineInput[];
  quoteId: string;
  rateId: string;
  paymentMethod: PaymentMethod;
  termsAccepted: boolean;
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
 * carrito/cotización/método de pago no pueden confundirse con un replay
 * legítimo — ver plan de 1.5 §C. Usa el MISMO `normalizeCartLines` que
 * `cart-fingerprint.ts` (fusiona líneas duplicadas antes de ordenar): sin
 * eso, dos payloads lógicamente idénticos con el mismo ítem repetido en
 * distinto orden relativo producirían hashes distintos y un replay
 * legítimo caería en el 409 de "clave ya usada para otro pedido".
 */
function computeRequestHash(input: CreateOrderHashInput): string {
  const normalizedLines = normalizeCartLines(input.lines);
  const canonical = JSON.stringify({
    lines: normalizedLines,
    quoteId: input.quoteId,
    rateId: input.rateId,
    paymentMethod: input.paymentMethod,
    termsAccepted: input.termsAccepted,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

/** Límites reales de Stripe para OXXO (10.00-10,000.00 MXN). Se valida en
 * el servidor ANTES de reservar stock (Milestone 1.6) — nunca confiar en
 * que el cliente eligió un método de pago compatible con su carrito. */
function assertOxxoAmountInRange(totalCents: number): void {
  if (totalCents < OXXO_MIN_AMOUNT_CENTS || totalCents > OXXO_MAX_AMOUNT_CENTS) {
    throw new AppError(
      `OXXO solo acepta pedidos entre $${(OXXO_MIN_AMOUNT_CENTS / 100).toFixed(2)} y $${(OXXO_MAX_AMOUNT_CENTS / 100).toFixed(2)} MXN.`,
      400,
    );
  }
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

export {
  IdempotencyConflictSignal,
  PendingOrderExistsSignal,
  OrderNumberConflictSignal,
  isDuplicateKeyError,
  keyPatternHas,
  computeRequestHash,
  assertOxxoAmountInRange,
  toPlainShippingAddress,
  toPlainParcel,
  toOrderLine,
};
export type { MongoDuplicateKeyError, CreateOrderHashInput, CreateOrderInput, CreateOrderResult };
