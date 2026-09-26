import type { Types, FilterQuery } from "mongoose";
import {
  OrderStatus,
  ShipmentTrackingStatus,
  ShippingLabelStatus,
  type AdminOrderCustomer,
  type ListQuery,
  type PaginationMeta,
  type ShipmentQueue,
} from "@esencia-glow/shared";
import { Order, type OrderAttrs } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { buildMeta, escapeRegex } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import { buildAdminShipmentRow, type LeanOrderForShipment } from "./shipment-dto.js";

/**
 * Lectura admin de `/admin/shipments` (Milestone 2.4): cuatro colas de
 * trabajo sobre `Order`, calcadas de `order-admin.service.ts` — mismo
 * `parseListQuery`/`resolveSort`/`buildMeta`, misma hidratación de clientes
 * en un solo batch. Las cajas de suscripción viven en otro modelo
 * (`SubscriptionShipment`) y las lee `subscription-shipment-panel.service.ts`;
 * el panel las une por pestaña, no por endpoint.
 */

const ADMIN_SHIPMENT_SORT_FIELDS = ["createdAt"] as const;

interface ListAdminShipmentsInput extends ListQuery {
  queue: ShipmentQueue;
}

interface LeanUserForShipment {
  _id: Types.ObjectId;
  email: string;
  firstName: string;
  lastName: string;
}

/** Solo se atienden envíos de órdenes ya pagadas — `pending`/`cancelled`/
 * `refunded` no tienen guía que operar. */
const SHIPPABLE_STATUSES = [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED];

const PROBLEM_LABEL_STATUSES = [ShippingLabelStatus.NEEDS_REVIEW, ShippingLabelStatus.FAILED];
const PROBLEM_TRACKING_STATUSES = [ShipmentTrackingStatus.EXCEPTION, ShipmentTrackingStatus.RETURNED];

/** Las tres colas "sanas" excluyen explícitamente lo que `problems` atrapa
 * — así las cuatro colas son disjuntas por construcción, nunca por
 * casualidad de qué llega primero. */
const NOT_PROBLEM: FilterQuery<OrderAttrs> = {
  "label.status": { $nin: PROBLEM_LABEL_STATUSES },
  "tracking.status": { $nin: PROBLEM_TRACKING_STATUSES },
};

function buildQueueFilter(queue: ShipmentQueue): FilterQuery<OrderAttrs> {
  switch (queue) {
    case "problems":
      return {
        status: { $in: SHIPPABLE_STATUSES },
        $or: [
          { "label.status": { $in: PROBLEM_LABEL_STATUSES } },
          { "tracking.status": { $in: PROBLEM_TRACKING_STATUSES } },
        ],
      };
    case "preparing":
      return { status: { $in: [OrderStatus.PAID, OrderStatus.PROCESSING] }, ...NOT_PROBLEM };
    case "transit":
      return { status: OrderStatus.SHIPPED, ...NOT_PROBLEM };
    case "delivered":
      return { status: OrderStatus.DELIVERED, ...NOT_PROBLEM };
  }
}

/**
 * `search` cubre lo que esta pantalla necesita ubicar: número de guía
 * (`label`/`shipment`, cualquiera que ya lo tenga), número de pedido exacto
 * en mayúsculas, y nombre/correo del cliente — mismo criterio de
 * pre-resolución contra `User` que `order-admin.service.ts` (el comprador
 * no se congela en la orden).
 */
async function buildSearchFilter(search: string): Promise<FilterQuery<OrderAttrs>> {
  const term = search.trim();
  const regex = new RegExp(escapeRegex(term), "i");
  const matchingUsers = await User.find({ $or: [{ email: regex }, { firstName: regex }, { lastName: regex }] })
    .select("_id")
    .lean();

  return {
    $or: [
      { orderNumber: term.toUpperCase() },
      { "label.trackingNumber": regex },
      { "shipment.trackingNumber": regex },
      { userId: { $in: matchingUsers.map((user) => user._id) } },
    ],
  };
}

function toAdminCustomer(user: LeanUserForShipment | undefined): AdminOrderCustomer | null {
  if (!user) return null;
  return { id: user._id.toString(), email: user.email, firstName: user.firstName, lastName: user.lastName };
}

async function resolveCustomers(orders: LeanOrderForShipment[]): Promise<Map<string, AdminOrderCustomer | null>> {
  const userIds = [...new Set(orders.map((order) => order.userId.toString()))];
  const users = await User.find({ _id: { $in: userIds } }).lean<LeanUserForShipment[]>();
  const userById = new Map(users.map((user) => [user._id.toString(), user]));
  return new Map(orders.map((order) => [order._id.toString(), toAdminCustomer(userById.get(order.userId.toString()))]));
}

async function listAdminShipments(
  input: ListAdminShipmentsInput,
): Promise<{ rows: ReturnType<typeof buildAdminShipmentRow>[]; meta: PaginationMeta }> {
  const clauses: FilterQuery<OrderAttrs>[] = [buildQueueFilter(input.queue)];
  if (input.search) clauses.push(await buildSearchFilter(input.search));
  const filter: FilterQuery<OrderAttrs> = clauses.length === 1 ? clauses[0]! : { $and: clauses };

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .select("orderNumber userId status priority shippingAddress label tracking shipment createdAt")
      .sort(resolveSort(input.sort, ADMIN_SHIPMENT_SORT_FIELDS, "createdAt"))
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean<LeanOrderForShipment[]>(),
    Order.countDocuments(filter),
  ]);

  const customerByOrderId = await resolveCustomers(orders);
  const rows = orders.map((order) => buildAdminShipmentRow(order, customerByOrderId.get(order._id.toString()) ?? null));

  return { rows, meta: buildMeta(total, input) };
}

export { listAdminShipments };
export type { ListAdminShipmentsInput };
