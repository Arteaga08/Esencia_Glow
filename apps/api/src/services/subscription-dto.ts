import type { Types } from "mongoose";
import type { EditionStatus, ShippingCarrier, SubscriptionShipmentStatus } from "@esencia-glow/shared";

/**
 * DTO admin del módulo de suscripciones (Milestone 1.7.1). Vive en la API,
 * no en `packages/shared`: precedente firme de `AdminProduct`/`AdminBundle`
 * — shared solo lleva los contratos `Public*`, y 1.7.1 no tiene ninguna ruta
 * pública todavía. Nunca expone `providerProductId`/`providerPriceId`: son
 * detalles de Stripe que 1.7.2 decide si algún día hacen falta en el panel.
 */

interface LeanSubscriptionPlan {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  priceCents: number;
  currency: string;
  billingInterval: string;
  maxActiveSeats: number;
  seatsTaken: number;
  isActive: boolean;
  sortOrder: number;
}

interface AdminSubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  priceCents: number;
  currency: string;
  billingInterval: string;
  maxActiveSeats: number;
  seatsTaken: number;
  isActive: boolean;
  sortOrder: number;
}

function buildAdminSubscriptionPlan(plan: LeanSubscriptionPlan): AdminSubscriptionPlan {
  return {
    id: plan._id.toString(),
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    ...(plan.shortDescription ? { shortDescription: plan.shortDescription } : {}),
    priceCents: plan.priceCents,
    currency: plan.currency,
    billingInterval: plan.billingInterval,
    maxActiveSeats: plan.maxActiveSeats,
    seatsTaken: plan.seatsTaken,
    isActive: plan.isActive,
    sortOrder: plan.sortOrder,
  };
}

interface LeanEditionItem {
  productId: Types.ObjectId;
  variantId: Types.ObjectId;
  quantity: number;
}

interface LeanSubscriptionEdition {
  _id: Types.ObjectId;
  planId: Types.ObjectId;
  cycleYear: number;
  cycleMonth: number;
  title: string;
  description?: string;
  items: LeanEditionItem[];
  status: EditionStatus;
  publishedAt?: Date;
  publishedBy?: Types.ObjectId;
}

interface AdminEditionItem {
  productId: string;
  variantId: string;
  quantity: number;
}

interface AdminSubscriptionEdition {
  id: string;
  planId: string;
  cycleYear: number;
  cycleMonth: number;
  title: string;
  description?: string;
  items: AdminEditionItem[];
  status: EditionStatus;
  publishedAt?: string;
}

function buildAdminEditionItem(item: LeanEditionItem): AdminEditionItem {
  return { productId: item.productId.toString(), variantId: item.variantId.toString(), quantity: item.quantity };
}

function buildAdminSubscriptionEdition(edition: LeanSubscriptionEdition): AdminSubscriptionEdition {
  return {
    id: edition._id.toString(),
    planId: edition.planId.toString(),
    cycleYear: edition.cycleYear,
    cycleMonth: edition.cycleMonth,
    title: edition.title,
    ...(edition.description ? { description: edition.description } : {}),
    items: edition.items.map(buildAdminEditionItem),
    status: edition.status,
    ...(edition.publishedAt ? { publishedAt: edition.publishedAt.toISOString() } : {}),
  };
}


/**
 * Envío del ciclo para el panel (Milestone 1.7.2b). `planName` y `customer`
 * viajan resueltos porque el panel los lista en la tabla: hidratarlos en el
 * cliente obligaría a un fetch por fila. `reservedItems` se expone tal cual
 * quedó al cobrar — es lo que la admin tiene que empacar, y puede diferir de
 * la edición cuando hubo faltante de inventario.
 */
interface LeanSubscriptionShipment {
  _id: Types.ObjectId;
  accountId: Types.ObjectId;
  userId: Types.ObjectId;
  planId: Types.ObjectId;
  editionId?: Types.ObjectId;
  cycleYear: number;
  cycleMonth: number;
  status: SubscriptionShipmentStatus;
  editionIncident: boolean;
  inventoryIncident: boolean;
  adminAlertedAt?: Date;
  reservedItems: { variantId: Types.ObjectId; quantity: number }[];
  carrier?: ShippingCarrier;
  trackingNumber?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  canceledAt?: Date;
  createdAt: Date;
}

interface AdminShipmentCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface AdminSubscriptionShipment {
  id: string;
  accountId: string;
  planId: string;
  planName: string;
  editionId?: string;
  cycleYear: number;
  cycleMonth: number;
  status: SubscriptionShipmentStatus;
  editionIncident: boolean;
  inventoryIncident: boolean;
  reservedItems: { variantId: string; quantity: number }[];
  carrier?: ShippingCarrier;
  trackingNumber?: string;
  shippedAt?: string;
  deliveredAt?: string;
  canceledAt?: string;
  customer: AdminShipmentCustomer | null;
  createdAt: string;
}

function buildAdminSubscriptionShipment(
  shipment: LeanSubscriptionShipment,
  planName: string,
  customer: AdminShipmentCustomer | null,
): AdminSubscriptionShipment {
  return {
    id: shipment._id.toString(),
    accountId: shipment.accountId.toString(),
    planId: shipment.planId.toString(),
    planName,
    ...(shipment.editionId ? { editionId: shipment.editionId.toString() } : {}),
    cycleYear: shipment.cycleYear,
    cycleMonth: shipment.cycleMonth,
    status: shipment.status,
    editionIncident: shipment.editionIncident,
    inventoryIncident: shipment.inventoryIncident,
    reservedItems: shipment.reservedItems.map((item) => ({
      variantId: item.variantId.toString(),
      quantity: item.quantity,
    })),
    ...(shipment.carrier ? { carrier: shipment.carrier } : {}),
    ...(shipment.trackingNumber ? { trackingNumber: shipment.trackingNumber } : {}),
    ...(shipment.shippedAt ? { shippedAt: shipment.shippedAt.toISOString() } : {}),
    ...(shipment.deliveredAt ? { deliveredAt: shipment.deliveredAt.toISOString() } : {}),
    ...(shipment.canceledAt ? { canceledAt: shipment.canceledAt.toISOString() } : {}),
    customer,
    createdAt: shipment.createdAt.toISOString(),
  };
}

export { buildAdminSubscriptionPlan, buildAdminSubscriptionEdition, buildAdminSubscriptionShipment };
export type {
  LeanSubscriptionPlan,
  AdminSubscriptionPlan,
  LeanEditionItem,
  LeanSubscriptionEdition,
  AdminEditionItem,
  AdminSubscriptionEdition,
  LeanSubscriptionShipment,
  AdminSubscriptionShipment,
  AdminShipmentCustomer,
};
