import type { Types } from "mongoose";
import type {
  AdminOrder,
  AdminOrderCustomer,
  AdminOrderPayment,
  AdminOrderStatusHistoryEntry,
  Currency,
  PublicOrder,
  PublicOrderLine,
  PublicOrderLineComponent,
  PublicOrderStatusHistoryEntry,
} from "@esencia-glow/shared";
import type { OrderAttrs } from "../models/order.model.js";
import type { OrderLineAttrs, OrderLineComponentAttrs } from "../models/order-line.schema.js";

/**
 * DTOs de `Order` — dos proyecciones del mismo documento (ver plan de 1.5
 * §H): `PublicOrder` (dueño de la orden) y `AdminOrder` (staff, §J). Mismo
 * precedente que catalog-dto.ts: reciben una forma estructural (`.lean()`),
 * nunca un `HydratedDocument` a secas — `createdAt`/`updatedAt` no viven en
 * `OrderAttrs` (igual que en el resto del repo, ver `LeanCategory`), así
 * que se declaran aparte aquí.
 *
 * Lo que NUNCA cruza en `PublicOrder`: `idempotencyKey`, `requestHash`,
 * `payment.intentId`, `internalNotes` (ni siquiera el conteo), `userId`
 * crudo, `actorId`/`reason` de la bitácora (eso es `AdminOrder`).
 * `AdminOrder` tampoco expone el CUERPO de `internalNotes` — solo su
 * conteo (`internalNotesCount`): son notas staff-a-staff, no parte del
 * contrato de lectura general de la orden.
 */
interface LeanOrder extends OrderAttrs {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

function buildPublicOrderLineComponent(component: OrderLineComponentAttrs): PublicOrderLineComponent {
  return {
    productId: component.productId.toString(),
    variantId: component.variantId.toString(),
    sku: component.sku,
    name: component.name,
    variantName: component.variantName,
    quantity: component.quantity,
    catalogUnitPriceCents: component.catalogUnitPriceCents,
  };
}

function buildPublicOrderLine(line: OrderLineAttrs): PublicOrderLine {
  return {
    itemType: line.itemType,
    itemId: line.itemId.toString(),
    sku: line.sku,
    name: line.name,
    ...(line.variantName ? { variantName: line.variantName } : {}),
    ...(line.attributes ? { attributes: line.attributes } : {}),
    unitPriceCents: line.unitPriceCents,
    quantity: line.quantity,
    lineTotalCents: line.lineTotalCents,
    ...(line.components ? { components: line.components.map(buildPublicOrderLineComponent) } : {}),
  };
}

function buildPublicStatusHistoryEntry(
  entry: OrderAttrs["statusHistory"][number],
): PublicOrderStatusHistoryEntry {
  return {
    status: entry.status,
    at: entry.at.toISOString(),
    actorType: entry.actorType,
  };
}

function buildPublicOrder(order: LeanOrder): PublicOrder {
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    status: order.status,
    lines: order.lines.map(buildPublicOrderLine),
    totals: {
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      taxCents: order.taxCents,
      taxRateBps: order.taxRateBps,
      shippingCents: order.shippingCents,
      totalCents: order.totalCents,
      currency: order.currency as Currency,
    },
    payment: {
      provider: order.payment.provider,
      method: order.payment.method,
      state: order.payment.state,
      captureMethod: order.payment.captureMethod,
      ...(order.payment.capturedAt ? { capturedAt: order.payment.capturedAt.toISOString() } : {}),
      ...(order.payment.card ? { card: order.payment.card } : {}),
      ...(order.payment.voucherExpiresAt ? { voucherExpiresAt: order.payment.voucherExpiresAt.toISOString() } : {}),
      ...(order.payment.refundedAmountCents !== undefined
        ? { refundedAmountCents: order.payment.refundedAmountCents }
        : {}),
    },
    shippingAddress: order.shippingAddress,
    shippingSelection: order.shippingSelection,
    parcel: order.parcel,
    ...(order.shipment
      ? {
          shipment: {
            carrier: order.shipment.carrier,
            ...(order.shipment.carrierName ? { carrierName: order.shipment.carrierName } : {}),
            trackingNumber: order.shipment.trackingNumber,
            ...(order.shipment.trackingUrl ? { trackingUrl: order.shipment.trackingUrl } : {}),
            shippedAt: order.shipment.shippedAt.toISOString(),
          },
        }
      : {}),
    statusHistory: order.statusHistory.map(buildPublicStatusHistoryEntry),
    priority: order.priority,
    ...(order.cancelReason ? { cancelReason: order.cancelReason } : {}),
    createdAt: order.createdAt.toISOString(),
    ...(order.expiresAt ? { expiresAt: order.expiresAt.toISOString() } : {}),
  };
}

function buildAdminStatusHistoryEntry(entry: OrderAttrs["statusHistory"][number]): AdminOrderStatusHistoryEntry {
  return {
    status: entry.status,
    at: entry.at.toISOString(),
    actorType: entry.actorType,
    ...(entry.actorId ? { actorId: entry.actorId.toString() } : {}),
    ...(entry.reason ? { reason: entry.reason } : {}),
  };
}

function buildAdminOrderPayment(payment: OrderAttrs["payment"]): AdminOrderPayment {
  return {
    provider: payment.provider,
    method: payment.method,
    state: payment.state,
    captureMethod: payment.captureMethod,
    ...(payment.capturedAt ? { capturedAt: payment.capturedAt.toISOString() } : {}),
    ...(payment.card ? { card: payment.card } : {}),
    ...(payment.voucherExpiresAt ? { voucherExpiresAt: payment.voucherExpiresAt.toISOString() } : {}),
    ...(payment.intentId ? { intentId: payment.intentId } : {}),
    ...(payment.lastError ? { lastError: payment.lastError } : {}),
    ...(payment.refundedAmountCents !== undefined ? { refundedAmountCents: payment.refundedAmountCents } : {}),
    ...(payment.refundedAt ? { refundedAt: payment.refundedAt.toISOString() } : {}),
  };
}

/**
 * `customer` viene resuelto (o `null`) por el caller — un `Order` solo
 * guarda `userId`, nunca un snapshot de nombre/email (§H: "se resuelven al
 * leer, no se congelan"), así que quien arma el listado/detalle admin debe
 * poblarlo con una query aparte (una sola, por batch, en el listado).
 */
function buildAdminOrder(order: LeanOrder, customer: AdminOrderCustomer | null): AdminOrder {
  const publicOrder = buildPublicOrder(order);
  return {
    ...publicOrder,
    customer,
    payment: buildAdminOrderPayment(order.payment),
    statusHistory: order.statusHistory.map(buildAdminStatusHistoryEntry),
    termsAcceptedAt: order.termsAcceptedAt.toISOString(),
    inventoryIncident: order.inventoryIncident,
    ...(order.adminAlertedAt ? { adminAlertedAt: order.adminAlertedAt.toISOString() } : {}),
    internalNotesCount: order.internalNotes.length,
    ...(order.disputedAt ? { disputedAt: order.disputedAt.toISOString() } : {}),
    ...(order.disputeStatus ? { disputeStatus: order.disputeStatus } : {}),
    ...(order.payment.refundRequestedAt ? { refundRequestedAt: order.payment.refundRequestedAt.toISOString() } : {}),
  };
}

export {
  buildPublicOrder,
  buildPublicOrderLine,
  buildPublicOrderLineComponent,
  buildAdminOrder,
  buildAdminOrderPayment,
  buildAdminStatusHistoryEntry,
};
export type { LeanOrder };
