import type { Currency } from "../constants/currency.js";
import type { OrderStatus } from "../enums/order-status.js";
import type { OrderPriority } from "../enums/order-priority.js";
import type { PaymentState } from "../enums/payment-state.js";
import type { ShippingCarrier } from "../enums/shipping-carrier.js";
import type { ProductAttributes, PublicProductImage } from "./catalog.js";
import type { PublicShippingAddress, PublicParcel } from "./shipping.js";

/**
 * DTOs del módulo de órdenes. Tres proyecciones del mismo documento — la
 * diferencia es de SEGURIDAD, no de comodidad (ver
 * ECOMMERCE_ARCHITECTURE_GUIDELINES.md §"DTOs: nunca un solo shape"):
 * `PublicOrder` (dueño de la orden), `AdminOrder extends PublicOrder`
 * (+ datos que solo el staff debe ver), `CheckoutResult` (respuesta del
 * checkout, sin ninguna noción de "pagado").
 */

/** "user" cubre tanto al cliente como a un admin humano — se distingue por
 * `actorId` (solo visible en `AdminOrderStatusHistoryEntry`), nunca por un
 * tercer valor aquí. */
type OrderHistoryActorType = "user" | "system";

interface PublicOrderLineComponent {
  productId: string;
  variantId: string;
  sku: string;
  name: string;
  variantName: string;
  quantity: number;
  /** Precio de catálogo del componente al momento de la venta — SOLO
   * referencia de fulfillment/devolución. Nunca suma al total de la orden:
   * el bundle cobra su propio precio manual (ver `unitPriceCents` de la
   * línea que lo contiene). */
  catalogUnitPriceCents: number;
}

interface PublicOrderLine {
  itemType: "product" | "bundle";
  itemId: string;
  sku: string;
  name: string;
  variantName?: string;
  attributes?: ProductAttributes;
  image?: PublicProductImage;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  /** Solo presente si `itemType === "bundle"`. */
  components?: PublicOrderLineComponent[];
}

interface PublicOrderTotals {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  taxRateBps: number;
  shippingCents: number;
  totalCents: number;
  currency: Currency;
}

interface PublicShippingSelection {
  rateId: string;
  carrier: ShippingCarrier;
  service: string;
  amountCents: number;
  estimatedDays: number;
}

interface PublicOrderPayment {
  provider: "stripe";
  state: PaymentState;
  captureMethod: "automatic";
  capturedAt?: string;
  card?: { brand: string; last4: string };
}

interface AdminOrderPayment extends PublicOrderPayment {
  intentId?: string;
  lastError?: string;
  refundedAmountCents?: number;
  refundedAt?: string;
}

interface OrderShipmentInfo {
  carrier: ShippingCarrier;
  carrierName?: string;
  trackingNumber: string;
  trackingUrl?: string;
  shippedAt: string;
}

interface PublicOrderStatusHistoryEntry {
  status: OrderStatus;
  at: string;
  actorType: OrderHistoryActorType;
}

interface AdminOrderStatusHistoryEntry extends PublicOrderStatusHistoryEntry {
  actorId?: string;
  reason?: string;
}

interface PublicOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  lines: PublicOrderLine[];
  totals: PublicOrderTotals;
  payment: PublicOrderPayment;
  shippingAddress: PublicShippingAddress;
  shippingSelection: PublicShippingSelection;
  parcel: PublicParcel;
  shipment?: OrderShipmentInfo;
  statusHistory: PublicOrderStatusHistoryEntry[];
  priority: OrderPriority;
  cancelReason?: string;
  createdAt: string;
  expiresAt?: string;
}

interface AdminOrderCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface AdminOrder extends Omit<PublicOrder, "payment" | "statusHistory"> {
  customer: AdminOrderCustomer | null;
  payment: AdminOrderPayment;
  statusHistory: AdminOrderStatusHistoryEntry[];
  termsAcceptedAt: string;
  inventoryIncident: boolean;
  adminAlertedAt?: string;
  internalNotesCount: number;
}

/** Respuesta del checkout. Nótese lo que NO trae: ninguna noción de
 * "pagado" — eso lo decide únicamente el webhook (Milestone 1.6). */
interface CheckoutResult {
  order: PublicOrder;
}

/** Lo que el cliente manda en `POST /orders`. */
interface CreateOrderLineInput {
  itemType: "product" | "bundle";
  itemId: string;
  quantity: number;
}

export type {
  OrderHistoryActorType,
  PublicOrderLineComponent,
  PublicOrderLine,
  PublicOrderTotals,
  PublicShippingSelection,
  PublicOrderPayment,
  AdminOrderPayment,
  OrderShipmentInfo,
  PublicOrderStatusHistoryEntry,
  AdminOrderStatusHistoryEntry,
  PublicOrder,
  AdminOrderCustomer,
  AdminOrder,
  CheckoutResult,
  CreateOrderLineInput,
};
