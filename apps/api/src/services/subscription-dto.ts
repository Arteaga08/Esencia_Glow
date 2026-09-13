import type { Types } from "mongoose";
import type { EditionStatus } from "@esencia-glow/shared";

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

export { buildAdminSubscriptionPlan, buildAdminSubscriptionEdition };
export type {
  LeanSubscriptionPlan,
  AdminSubscriptionPlan,
  LeanEditionItem,
  LeanSubscriptionEdition,
  AdminEditionItem,
  AdminSubscriptionEdition,
};
