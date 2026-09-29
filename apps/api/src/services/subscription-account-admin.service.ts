import type { FilterQuery, Types } from "mongoose";
import { SubscriptionStatus, type ListQuery, type PaginationMeta } from "@esencia-glow/shared";
import { SubscriptionAccount, type SubscriptionAccountAttrs } from "../models/subscription-account.model.js";
import { SubscriptionPlan } from "../models/subscription-plan.model.js";
import { User } from "../models/user.model.js";
import { AuditLog } from "../models/audit-log.model.js";
import { AppError } from "../utils/app-error.js";
import { buildMeta, escapeRegex } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import {
  buildAdminSubscriptionAccountDetail,
  buildAdminSubscriptionAccountListItem,
  buildAdminSubscriptionAccountStatusHistory,
  type AdminSubscriptionAccountDetail,
  type AdminSubscriptionAccountListItem,
  type AdminSubscriptionAccountPlan,
  type AdminSubscriptionAccountUser,
  type LeanAdminAccount,
} from "./subscription-account-admin-dto.js";

/**
 * Lectura admin de Cuentas de suscripción (Milestone 2.7a): listado con
 * filtros/búsqueda, detalle y `/activity`. Solo lectura — cualquier acción
 * (pausar/cancelar desde el panel) queda deliberadamente fuera de esta
 * sesión, mismo criterio que "dar cupón" en 2.6.
 */

const ADMIN_SUBSCRIPTION_ACCOUNT_SORT_FIELDS = ["currentPeriodEnd", "startedAt", "createdAt"] as const;

/** Cuentas cuyo cobro está fallando (`past_due`) o cuya alta se quedó a
 * medias (`incomplete`, ver `expire-incomplete-subscriptions.ts` — el job
 * la resuelve sola, pero mientras tanto sí es una cuenta a vigilar). */
const ATTENTION_STATUSES: readonly SubscriptionStatus[] = [SubscriptionStatus.PAST_DUE, SubscriptionStatus.INCOMPLETE];

/** Proyección explícita: nunca `providerCustomerId`, `providerSubscriptionId`,
 * `latestInvoiceId`, `dunningInvoiceId`, `cancelReason` ni `seatHeldAt`
 * cruzan a este módulo. `statusHistory` solo se trae en el detalle (ver
 * `getAdminSubscriptionAccountById`), no en el listado. */
const LIST_PROJECTION =
  "userId planId status billingInterval cancelAtPeriodEnd startedAt currentPeriodEnd pastDueSince dunningAttempts pendingPlanChange createdAt";
const DETAIL_PROJECTION = `${LIST_PROJECTION} statusHistory`;

interface ListAdminSubscriptionAccountsInput extends ListQuery {
  status?: SubscriptionStatus;
  planId?: string;
  attention?: boolean;
}

interface LeanUserForAccount {
  _id: Types.ObjectId;
  email: string;
  firstName: string;
  lastName: string;
}

interface LeanPlanForAccount {
  _id: Types.ObjectId;
  name: string;
}

function toAccountUser(user: LeanUserForAccount | undefined): AdminSubscriptionAccountUser | null {
  if (!user) return null;
  return { id: user._id.toString(), email: user.email, firstName: user.firstName, lastName: user.lastName };
}

function toAccountPlan(plan: LeanPlanForAccount | undefined): AdminSubscriptionAccountPlan | null {
  if (!plan) return null;
  return { id: plan._id.toString(), name: plan.name };
}

/** Un query por colección + `Map`, nunca `populate()` por fila (N+1 en el
 * camino caliente del listado) — mismo patrón que
 * subscription-shipment-panel.service.ts. */
async function resolveAccountUsers(accounts: LeanAdminAccount[]): Promise<Map<string, LeanUserForAccount>> {
  const userIds = [...new Set(accounts.map((account) => account.userId.toString()))];
  if (userIds.length === 0) return new Map();
  const users = await User.find({ _id: { $in: userIds } })
    .select("email firstName lastName")
    .lean<LeanUserForAccount[]>();
  return new Map(users.map((user) => [user._id.toString(), user]));
}

async function resolveAccountPlans(accounts: LeanAdminAccount[]): Promise<Map<string, LeanPlanForAccount>> {
  const planIds = [...new Set(accounts.map((account) => account.planId.toString()))];
  if (planIds.length === 0) return new Map();
  const plans = await SubscriptionPlan.find({ _id: { $in: planIds } })
    .select("name")
    .lean<LeanPlanForAccount[]>();
  return new Map(plans.map((plan) => [plan._id.toString(), plan]));
}

function buildFilter(input: ListAdminSubscriptionAccountsInput): FilterQuery<SubscriptionAccountAttrs> {
  const filter: FilterQuery<SubscriptionAccountAttrs> = {};
  if (input.status) filter.status = input.status;
  if (input.planId) filter.planId = input.planId;
  // `attention` es un atajo sobre VARIAS condiciones a la vez — nunca se
  // combina con `status` puntual (rechazado antes, en el validator, con
  // `.oxor`) para que este `$or` no se pierda bajo un `status` más
  // específico escrito por error.
  if (input.attention === true) {
    filter.$or = [{ status: { $in: ATTENTION_STATUSES } }, { pendingPlanChange: { $exists: true } }];
  }
  return filter;
}

async function resolveSearchUserIds(search: string): Promise<Types.ObjectId[] | null> {
  const regex = new RegExp(escapeRegex(search), "i");
  const matchingUsers = await User.find({ $or: [{ email: regex }, { firstName: regex }, { lastName: regex }] })
    .select("_id")
    .lean();
  if (matchingUsers.length === 0) return null;
  return matchingUsers.map((user) => user._id);
}

async function listAdminSubscriptionAccounts(
  input: ListAdminSubscriptionAccountsInput,
): Promise<{ rows: AdminSubscriptionAccountListItem[]; meta: PaginationMeta }> {
  const filter = buildFilter(input);

  if (input.search) {
    const userIds = await resolveSearchUserIds(input.search);
    // Sin coincidencias: se fuerza un filtro que nunca hace match, nunca se
    // omite `userId` (eso traería TODAS las cuentas) — mismo criterio que el
    // borde de `use-customer-orders.ts` corregido en 2.6.
    filter.userId = { $in: userIds ?? [] };
  }

  const [accounts, total] = await Promise.all([
    SubscriptionAccount.find(filter)
      .select(LIST_PROJECTION)
      .sort(resolveSort(input.sort, ADMIN_SUBSCRIPTION_ACCOUNT_SORT_FIELDS, "currentPeriodEnd"))
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean<LeanAdminAccount[]>(),
    SubscriptionAccount.countDocuments(filter),
  ]);

  const [userById, planById] = await Promise.all([resolveAccountUsers(accounts), resolveAccountPlans(accounts)]);

  const rows = accounts.map((account) =>
    buildAdminSubscriptionAccountListItem(
      account,
      toAccountUser(userById.get(account.userId.toString())),
      toAccountPlan(planById.get(account.planId.toString())),
    ),
  );

  return { rows, meta: buildMeta(total, input) };
}

async function getAdminSubscriptionAccountById(accountId: string): Promise<AdminSubscriptionAccountDetail> {
  const account = await SubscriptionAccount.findById(accountId).select(DETAIL_PROJECTION).lean<LeanAdminAccount>();
  if (!account) throw new AppError("Cuenta de suscripción no encontrada.", 404);

  const [user, plan] = await Promise.all([
    User.findById(account.userId).select("email firstName lastName").lean<LeanUserForAccount>(),
    SubscriptionPlan.findById(account.planId).select("name").lean<LeanPlanForAccount>(),
  ]);

  const listItem = buildAdminSubscriptionAccountListItem(account, toAccountUser(user ?? undefined), toAccountPlan(plan ?? undefined));
  const statusHistory = buildAdminSubscriptionAccountStatusHistory(account.statusHistory ?? []);

  return buildAdminSubscriptionAccountDetail(listItem, statusHistory);
}

interface SubscriptionAccountActivityEntry {
  action: string;
  actorId?: string;
  at: string;
}

interface LeanAuditLogEntry {
  action: string;
  actorId?: Types.ObjectId;
  createdAt: Date;
}

/** Bitácora de la cuenta SIN `metadata` — calcada de `getOrderActivity`:
 * responde "quién hizo qué y cuándo", nunca el detalle libre que
 * `metadata` pudiera cargar (puede llevar PII, ver el comentario de
 * `getOrderActivity`). */
async function getSubscriptionAccountActivity(accountId: string): Promise<SubscriptionAccountActivityEntry[]> {
  const exists = await SubscriptionAccount.exists({ _id: accountId });
  if (!exists) throw new AppError("Cuenta de suscripción no encontrada.", 404);

  const entries = await AuditLog.find({ targetId: accountId })
    .sort({ createdAt: -1 })
    .select("action actorId createdAt")
    .lean<LeanAuditLogEntry[]>();

  return entries.map((entry) => ({
    action: entry.action,
    ...(entry.actorId ? { actorId: entry.actorId.toString() } : {}),
    at: entry.createdAt.toISOString(),
  }));
}

export { listAdminSubscriptionAccounts, getAdminSubscriptionAccountById, getSubscriptionAccountActivity };
export type { ListAdminSubscriptionAccountsInput, SubscriptionAccountActivityEntry };
