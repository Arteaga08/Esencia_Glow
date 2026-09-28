import type { ShippingCarrier, SubscriptionShipmentStatus, SubscriptionStatus } from "@esencia-glow/shared";

/**
 * Espejo manual de `AdminSubscriptionShipment`/`AdminShipmentCustomer`, que
 * arma `apps/api/src/services/subscription-dto.ts` — ese archivo documenta
 * explícitamente por qué los DTO admin de suscripción viven solo en la API
 * (no derivan de un `Public*` de `@esencia-glow/shared`, a diferencia de
 * `AdminOrder`). Mismo criterio que `admin-catalog.ts`: mantener
 * sincronizado a mano cuando el DTO cambie del lado de la API.
 */
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

/**
 * Espejo manual de `AdminSubscriptionAccount*`, que arma
 * `apps/api/src/services/subscription-account-admin-dto.ts` (Milestone
 * 2.7a) — mismo criterio que el resto de este archivo: los DTO admin de
 * suscripción viven solo en la API.
 */
interface AdminSubscriptionAccountUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AdminSubscriptionAccountPlan {
  id: string;
  name: string;
}

interface AdminSubscriptionAccountListItem {
  id: string;
  user: AdminSubscriptionAccountUser;
  plan: AdminSubscriptionAccountPlan | null;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  startedAt?: string;
  currentPeriodEnd?: string;
  pastDueSince?: string;
  dunningAttempts: number;
  createdAt: string;
}

interface AdminSubscriptionAccountStatusHistoryEntry {
  status: SubscriptionStatus;
  at: string;
  actorType: "user" | "system";
}

interface AdminSubscriptionAccountDetail extends AdminSubscriptionAccountListItem {
  statusHistory: AdminSubscriptionAccountStatusHistoryEntry[];
}

interface AdminSubscriptionAccountActivityEntry {
  action: string;
  actorId?: string;
  at: string;
}

export type {
  AdminShipmentCustomer,
  AdminSubscriptionShipment,
  AdminSubscriptionAccountUser,
  AdminSubscriptionAccountPlan,
  AdminSubscriptionAccountListItem,
  AdminSubscriptionAccountStatusHistoryEntry,
  AdminSubscriptionAccountDetail,
  AdminSubscriptionAccountActivityEntry,
};
