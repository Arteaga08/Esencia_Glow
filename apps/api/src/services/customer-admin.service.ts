import type { Types } from "mongoose";
import {
  OrderStatus,
  UserRole,
  type AdminCustomerDetail,
  type AdminCustomerListItem,
  type ListQuery,
  type PaginationMeta,
  type SubscriptionStatus,
} from "@esencia-glow/shared";
import { User } from "../models/user.model.js";
import { Order } from "../models/order.model.js";
import { SubscriptionAccount } from "../models/subscription-account.model.js";
import { SubscriptionPlan } from "../models/subscription-plan.model.js";
import { AppError } from "../utils/app-error.js";
import { buildMeta, escapeRegex } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import {
  buildAdminCustomerDetail,
  buildAdminCustomerListItem,
  buildAdminCustomerStats,
  buildAdminCustomerSubscription,
  type LeanCustomerUser,
  type LeanSubscriptionAccount,
  type LeanSubscriptionPlan,
} from "./customer-dto.js";

/**
 * Lectura admin del módulo de Clientes (Milestone 2.6): listado con
 * búsqueda y detalle con pedidos/suscripción. Solo lectura — cualquier
 * acción (p. ej. "dar cupón") queda deliberadamente fuera de esta sesión,
 * ver [[esencia-glow-2-6]].
 */

const ADMIN_CUSTOMER_SORT_FIELDS = ["createdAt", "firstName", "email"] as const;

/** Mismo criterio que `PURCHASED_ORDER_STATUSES` del plan: un pedido cuenta
 * para las métricas del cliente solo si de verdad se compró. `pending`
 * (carrito abandonado), `cancelled` y `refunded` quedan fuera. */
const PURCHASED_ORDER_STATUSES: readonly OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

/** Proyección explícita: nunca `password`, `twoFactor.*`, `sessionVersion`
 * ni `passwordChangedAt` cruzan a este módulo. */
const CUSTOMER_LIST_PROJECTION = "email firstName lastName emailVerified createdAt";

interface CustomerStatsRow {
  _id: Types.ObjectId;
  orderCount: number;
  spentCents: number;
  lastOrderAt: Date;
}

async function resolveCustomerStats(userIds: Types.ObjectId[]): Promise<Map<string, CustomerStatsRow>> {
  if (userIds.length === 0) return new Map();
  const rows = await Order.aggregate<CustomerStatsRow>([
    { $match: { userId: { $in: userIds }, status: { $in: PURCHASED_ORDER_STATUSES } } },
    { $group: { _id: "$userId", orderCount: { $sum: 1 }, spentCents: { $sum: "$totalCents" }, lastOrderAt: { $max: "$createdAt" } } },
  ]);
  return new Map(rows.map((row) => [row._id.toString(), row]));
}

async function resolveSubscriptionStatuses(userIds: Types.ObjectId[]): Promise<Map<string, SubscriptionStatus>> {
  if (userIds.length === 0) return new Map();
  const accounts = await SubscriptionAccount.find({ userId: { $in: userIds } })
    .select("userId status")
    .lean<{ userId: Types.ObjectId; status: SubscriptionStatus }[]>();
  return new Map(accounts.map((account) => [account.userId.toString(), account.status]));
}

async function listAdminCustomers(
  input: ListQuery,
): Promise<{ rows: AdminCustomerListItem[]; meta: PaginationMeta }> {
  const filter: Record<string, unknown> = { role: UserRole.CUSTOMER };

  if (input.search) {
    const regex = new RegExp(escapeRegex(input.search), "i");
    filter.$or = [{ email: regex }, { firstName: regex }, { lastName: regex }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select(CUSTOMER_LIST_PROJECTION)
      .sort(resolveSort(input.sort, ADMIN_CUSTOMER_SORT_FIELDS, "createdAt"))
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean<LeanCustomerUser[]>(),
    User.countDocuments(filter),
  ]);

  const userIds = users.map((user) => user._id);
  const [statsByUserId, subscriptionStatusByUserId] = await Promise.all([
    resolveCustomerStats(userIds),
    resolveSubscriptionStatuses(userIds),
  ]);

  const rows = users.map((user) => {
    const statsRow = statsByUserId.get(user._id.toString());
    const stats = buildAdminCustomerStats(statsRow?.orderCount ?? 0, statsRow?.spentCents ?? 0, statsRow?.lastOrderAt ?? null);
    const subscriptionStatus = subscriptionStatusByUserId.get(user._id.toString()) ?? null;
    return buildAdminCustomerListItem(user, stats, subscriptionStatus);
  });

  return { rows, meta: buildMeta(total, input) };
}

async function getAdminCustomerById(customerId: string): Promise<AdminCustomerDetail> {
  const user = await User.findOne({ _id: customerId, role: UserRole.CUSTOMER })
    .select(CUSTOMER_LIST_PROJECTION)
    .lean<LeanCustomerUser>();
  if (!user) throw new AppError("Cliente no encontrado.", 404);

  const [statsRow, subscriptionStatusByUserId, lastOrder, account] = await Promise.all([
    resolveCustomerStats([user._id]).then((map) => map.get(user._id.toString())),
    resolveSubscriptionStatuses([user._id]),
    Order.findOne({ userId: user._id, status: { $in: PURCHASED_ORDER_STATUSES } })
      .sort({ createdAt: -1 })
      .select("shippingAddress")
      .lean<{ shippingAddress: AdminCustomerDetail["lastShippingAddress"] }>(),
    SubscriptionAccount.findOne({ userId: user._id }).lean<LeanSubscriptionAccount>(),
  ]);

  const stats = buildAdminCustomerStats(statsRow?.orderCount ?? 0, statsRow?.spentCents ?? 0, statsRow?.lastOrderAt ?? null);
  const subscriptionStatus = subscriptionStatusByUserId.get(user._id.toString()) ?? null;
  const listItem = buildAdminCustomerListItem(user, stats, subscriptionStatus);

  const plan = account
    ? await SubscriptionPlan.findById(account.planId).select("name priceCents currency").lean<LeanSubscriptionPlan>()
    : undefined;
  const subscription = account ? buildAdminCustomerSubscription(account, plan ?? undefined) : null;

  return buildAdminCustomerDetail(listItem, lastOrder?.shippingAddress ?? null, subscription);
}

export { listAdminCustomers, getAdminCustomerById, PURCHASED_ORDER_STATUSES };
