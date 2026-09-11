import type { Types, FilterQuery } from "mongoose";
import {
  matchStatusGroup,
  type AdminOrder,
  type AdminOrderCustomer,
  type ListQuery,
  type OrderPriority,
  type OrderStatus,
  type PaginationMeta,
} from "@esencia-glow/shared";
import { Order, type OrderAttrs } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { AuditLog } from "../models/audit-log.model.js";
import { AppError } from "../utils/app-error.js";
import { buildMeta, escapeRegex } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import { buildAdminOrder, type LeanOrder } from "./order-dto.js";

/**
 * Lectura admin del módulo de órdenes (ver plan de 1.5 §J): listado con
 * filtros/búsqueda, detalle y `/activity`. `ORDER_STATUS_GROUPS`/`?group=`
 * viven en `order-summary.service.ts` — leen el MISMO arreglo compartido
 * (`@esencia-glow/shared`) que este listado para que la tarjeta KPI y el
 * filtro correspondiente nunca diverjan.
 */

const ADMIN_ORDER_SORT_FIELDS = ["createdAt", "totalCents", "status", "priority"] as const;

interface ListAdminOrdersInput extends ListQuery {
  status?: OrderStatus;
  group?: string;
  priority?: OrderPriority;
  orderNumber?: string;
  incident?: boolean;
}

interface LeanUserForOrder {
  _id: Types.ObjectId;
  email: string;
  firstName: string;
  lastName: string;
}

function toAdminCustomer(user: LeanUserForOrder | undefined): AdminOrderCustomer | null {
  if (!user) return null;
  return { id: user._id.toString(), email: user.email, firstName: user.firstName, lastName: user.lastName };
}

async function resolveOrderCustomers(orders: LeanOrder[]): Promise<Map<string, AdminOrderCustomer | null>> {
  const userIds = [...new Set(orders.map((order) => order.userId.toString()))];
  const users = await User.find({ _id: { $in: userIds } }).lean<LeanUserForOrder[]>();
  const userById = new Map(users.map((user) => [user._id.toString(), user]));
  return new Map(orders.map((order) => [order._id.toString(), toAdminCustomer(userById.get(order.userId.toString()))]));
}

/**
 * `search` resuelve primero contra `User` (correo/nombre) — el comprador NO
 * se congela en la orden (§H) — y arma `userId: {$in}`, más el contacto
 * CONGELADO de `shippingAddress` (nombre/teléfono): sin esa pre-resolución,
 * buscar por correo no encontraría nada. `orderNumber` usa match exacto en
 * mayúsculas (barato, sin `$regex`); `search` sí usa `$regex` (escapado).
 */
async function listAdminOrders(
  input: ListAdminOrdersInput,
): Promise<{ rows: AdminOrder[]; meta: PaginationMeta }> {
  const filter: FilterQuery<OrderAttrs> = {};

  if (input.orderNumber) filter.orderNumber = input.orderNumber.toUpperCase();
  if (input.priority) filter.priority = input.priority;
  if (input.incident !== undefined) filter.inventoryIncident = input.incident;

  if (input.group) {
    const statuses = matchStatusGroup(input.group);
    if (!statuses) throw new AppError(`Grupo de estatus desconocido: ${input.group}.`, 400);
    filter.status = { $in: statuses };
  } else if (input.status) {
    filter.status = input.status;
  }

  if (input.search) {
    const regex = new RegExp(escapeRegex(input.search), "i");
    const matchingUsers = await User.find({ $or: [{ email: regex }, { firstName: regex }, { lastName: regex }] })
      .select("_id")
      .lean();
    filter.$or = [
      { userId: { $in: matchingUsers.map((user) => user._id) } },
      { "shippingAddress.fullName": regex },
      { "shippingAddress.phone": regex },
    ];
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort(resolveSort(input.sort, ADMIN_ORDER_SORT_FIELDS, "createdAt"))
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean<LeanOrder[]>(),
    Order.countDocuments(filter),
  ]);

  const customerByOrderId = await resolveOrderCustomers(orders);
  const rows = orders.map((order) => buildAdminOrder(order, customerByOrderId.get(order._id.toString()) ?? null));

  return { rows, meta: buildMeta(total, input) };
}

async function getAdminOrderById(orderId: string): Promise<AdminOrder> {
  const order = await Order.findById(orderId).lean<LeanOrder>();
  if (!order) throw new AppError("Pedido no encontrado.", 404);
  const customer = await User.findById(order.userId).lean<LeanUserForOrder>();
  return buildAdminOrder(order, toAdminCustomer(customer ?? undefined));
}

interface OrderActivityEntry {
  action: string;
  actorId?: string;
  at: string;
}

interface LeanAuditLogEntry {
  action: string;
  actorId?: Types.ObjectId;
  createdAt: Date;
}

/**
 * Audit log de la orden SIN `metadata` (before/after) — responde "quién
 * hizo qué y cuándo", nunca "qué cambió" (§J: `metadata` es `Mixed` y puede
 * cargar PII, como una dirección completa).
 */
async function getOrderActivity(orderId: string): Promise<OrderActivityEntry[]> {
  const exists = await Order.exists({ _id: orderId });
  if (!exists) throw new AppError("Pedido no encontrado.", 404);

  const entries = await AuditLog.find({ targetId: orderId })
    .sort({ createdAt: -1 })
    .select("action actorId createdAt")
    .lean<LeanAuditLogEntry[]>();

  return entries.map((entry) => ({
    action: entry.action,
    ...(entry.actorId ? { actorId: entry.actorId.toString() } : {}),
    at: entry.createdAt.toISOString(),
  }));
}

export { listAdminOrders, getAdminOrderById, getOrderActivity, toAdminCustomer };
export type { ListAdminOrdersInput, OrderActivityEntry };
