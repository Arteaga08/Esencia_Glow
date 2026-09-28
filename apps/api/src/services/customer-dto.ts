import type { Types } from "mongoose";
import type {
  AdminCustomerDetail,
  AdminCustomerListItem,
  AdminCustomerStats,
  AdminCustomerSubscription,
  PublicShippingAddress,
  SubscriptionStatus,
} from "@esencia-glow/shared";
import type { SubscriptionAccountAttrs } from "../models/subscription-account.model.js";
import type { SubscriptionPlanAttrs } from "../models/subscription-plan.model.js";

/**
 * DTOs del panel admin de Clientes (Milestone 2.6) — mismo criterio que
 * `order-dto.ts`: proyecciones explícitas campo a campo sobre `.lean()`,
 * nunca un `HydratedDocument` a secas. `LeanUser` deliberadamente NO
 * extiende `UserAttrs` completo: solo declara los campos que el listado
 * puede proyectar (`.select(...)` en `customer-admin.service.ts`), así un
 * campo sensible que se cuele en el `.select()` por error rompe el tipo
 * aquí, no solo en tiempo de ejecución.
 */
interface LeanCustomerUser {
  _id: Types.ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  createdAt: Date;
}

interface LeanSubscriptionAccount extends SubscriptionAccountAttrs {
  _id: Types.ObjectId;
}

interface LeanSubscriptionPlan extends SubscriptionPlanAttrs {
  _id: Types.ObjectId;
}

function buildAdminCustomerStats(orderCount: number, spentCents: number, lastOrderAt: Date | null): AdminCustomerStats {
  return { orderCount, spentCents, lastOrderAt: lastOrderAt ? lastOrderAt.toISOString() : null };
}

function buildAdminCustomerListItem(
  user: LeanCustomerUser,
  stats: AdminCustomerStats,
  subscriptionStatus: SubscriptionStatus | null,
): AdminCustomerListItem {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
    stats,
    subscriptionStatus,
  };
}

function buildAdminCustomerSubscription(
  account: LeanSubscriptionAccount,
  plan: LeanSubscriptionPlan | undefined,
): AdminCustomerSubscription {
  return {
    id: account._id.toString(),
    status: account.status,
    plan: plan ? { id: plan._id.toString(), name: plan.name, priceCents: plan.priceCents, currency: plan.currency } : null,
    ...(account.startedAt ? { startedAt: account.startedAt.toISOString() } : {}),
    ...(account.currentPeriodEnd ? { currentPeriodEnd: account.currentPeriodEnd.toISOString() } : {}),
    cancelAtPeriodEnd: account.cancelAtPeriodEnd,
    ...(account.pausedAt ? { pausedAt: account.pausedAt.toISOString() } : {}),
    ...(account.canceledAt ? { canceledAt: account.canceledAt.toISOString() } : {}),
  };
}

function buildAdminCustomerDetail(
  listItem: AdminCustomerListItem,
  lastShippingAddress: PublicShippingAddress | null,
  subscription: AdminCustomerSubscription | null,
): AdminCustomerDetail {
  return { ...listItem, lastShippingAddress, subscription };
}

export {
  buildAdminCustomerStats,
  buildAdminCustomerListItem,
  buildAdminCustomerSubscription,
  buildAdminCustomerDetail,
};
export type { LeanCustomerUser, LeanSubscriptionAccount, LeanSubscriptionPlan };
