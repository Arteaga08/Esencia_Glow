import type { Types } from "mongoose";
import type { SubscriptionStatus } from "@esencia-glow/shared";
import type { SubscriptionAccountAttrs } from "../models/subscription-account.model.js";

/**
 * DTOs del panel admin de Cuentas de suscripción (Milestone 2.7a). Vive en
 * la API, no en `packages/shared` — mismo precedente que
 * `subscription-dto.ts` (Plan/Edición/Envío): shared solo lleva contratos
 * `Public*`, y este módulo no tiene ninguna ruta pública.
 *
 * `LeanAdminAccount` NO extiende `SubscriptionAccountAttrs` completo: solo
 * declara los campos que el listado/detalle proyectan, mismo criterio que
 * `LeanCustomerUser` en customer-dto.ts — un campo sensible que se cuele en
 * el `.select()`/`.lean()` rompe el tipo aquí, no solo en runtime. NUNCA
 * `providerCustomerId`, `providerSubscriptionId`, `latestInvoiceId`,
 * `dunningInvoiceId`, `cancelReason`, `seatHeldAt`, ni el `reason`/`actorId`
 * de cada entrada de `statusHistory`.
 */
interface LeanAdminAccount {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  planId: Types.ObjectId;
  status: SubscriptionStatus;
  billingInterval?: "month" | "year";
  cancelAtPeriodEnd: boolean;
  startedAt?: Date;
  currentPeriodEnd?: Date;
  pastDueSince?: Date;
  dunningAttempts: number;
  pendingPlanChange?: { planId: Types.ObjectId };
  createdAt: Date;
  statusHistory?: SubscriptionAccountAttrs["statusHistory"];
}

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
  /** Intervalo de cobro (Milestone 2.7b). Siempre presente en el DTO,
   * normalizado a `"month"` cuando la cuenta no tiene el campo. */
  billingInterval: "month" | "year";
  cancelAtPeriodEnd: boolean;
  startedAt?: string;
  currentPeriodEnd?: string;
  pastDueSince?: string;
  dunningAttempts: number;
  createdAt: string;
}

/** Entrada de historial SIN `reason` (texto libre de la clienta/admin) ni
 * `actorId` — mismo criterio que `OrderActivityEntry`/`getOrderActivity`:
 * el panel responde "qué pasó y cuándo", no el detalle libre de por qué. */
interface AdminSubscriptionAccountStatusHistoryEntry {
  status: SubscriptionStatus;
  at: string;
  actorType: "user" | "system";
}

interface AdminSubscriptionAccountDetail extends AdminSubscriptionAccountListItem {
  statusHistory: AdminSubscriptionAccountStatusHistoryEntry[];
}

function buildAdminSubscriptionAccountListItem(
  account: LeanAdminAccount,
  user: AdminSubscriptionAccountUser | null,
  plan: AdminSubscriptionAccountPlan | null,
): AdminSubscriptionAccountListItem {
  return {
    id: account._id.toString(),
    // Defensivo: `planId` siempre referencia un plan real (los planes solo
    // se desactivan, nunca se borran), pero un `plan` ausente en el mapa de
    // lote nunca debe tumbar la fila — se lee como "no encontrado".
    user: user ?? { id: account.userId.toString(), firstName: "", lastName: "", email: "" },
    plan,
    status: account.status,
    billingInterval: account.billingInterval === "year" ? "year" : "month",
    cancelAtPeriodEnd: account.cancelAtPeriodEnd,
    ...(account.startedAt ? { startedAt: account.startedAt.toISOString() } : {}),
    ...(account.currentPeriodEnd ? { currentPeriodEnd: account.currentPeriodEnd.toISOString() } : {}),
    ...(account.pastDueSince ? { pastDueSince: account.pastDueSince.toISOString() } : {}),
    dunningAttempts: account.dunningAttempts,
    createdAt: account.createdAt.toISOString(),
  };
}

function buildAdminSubscriptionAccountStatusHistory(
  statusHistory: SubscriptionAccountAttrs["statusHistory"],
): AdminSubscriptionAccountStatusHistoryEntry[] {
  return statusHistory.map((entry) => ({
    status: entry.status,
    at: entry.at.toISOString(),
    actorType: entry.actorType,
  }));
}

function buildAdminSubscriptionAccountDetail(
  listItem: AdminSubscriptionAccountListItem,
  statusHistory: AdminSubscriptionAccountStatusHistoryEntry[],
): AdminSubscriptionAccountDetail {
  return { ...listItem, statusHistory };
}

export {
  buildAdminSubscriptionAccountListItem,
  buildAdminSubscriptionAccountStatusHistory,
  buildAdminSubscriptionAccountDetail,
};
export type {
  LeanAdminAccount,
  AdminSubscriptionAccountUser,
  AdminSubscriptionAccountPlan,
  AdminSubscriptionAccountListItem,
  AdminSubscriptionAccountStatusHistoryEntry,
  AdminSubscriptionAccountDetail,
};
