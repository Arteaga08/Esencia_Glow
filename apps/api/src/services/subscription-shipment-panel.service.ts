import type { FilterQuery, Types } from "mongoose";
import type { ListQuery, PaginationMeta, SubscriptionShipmentStatus } from "@esencia-glow/shared";
import {
  SubscriptionShipment,
  type SubscriptionShipmentAttrs,
} from "../models/subscription-shipment.model.js";
import { SubscriptionPlan } from "../models/subscription-plan.model.js";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import { buildMeta } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import {
  buildAdminSubscriptionShipment,
  type AdminShipmentCustomer,
  type AdminSubscriptionShipment,
  type LeanSubscriptionShipment,
} from "./subscription-dto.js";

/**
 * Lectura admin del panel de envíos (Milestone 1.7.2b) — calcado de
 * `order-admin.service.ts`, separado del servicio de transiciones por el
 * mismo criterio que separa `order-admin.service.ts` de
 * `order-admin-status.service.ts`: leer y mover un envío tienen riesgos
 * distintos y no comparten nada más que el modelo.
 *
 * Plan y suscriptora se hidratan con UN query por colección y un `Map`,
 * nunca un `populate` por fila (N+1 en el camino caliente del panel).
 */

const ADMIN_SHIPMENT_SORT_FIELDS = ["createdAt", "status", "cycleYear", "cycleMonth"] as const;

interface ListAdminShipmentsInput extends ListQuery {
  status?: SubscriptionShipmentStatus;
  planId?: string;
  cycleYear?: number;
  cycleMonth?: number;
  incident?: boolean;
}

interface LeanUserForShipment {
  _id: Types.ObjectId;
  email: string;
  firstName: string;
  lastName: string;
}

function toShipmentCustomer(user: LeanUserForShipment | undefined): AdminShipmentCustomer | null {
  if (!user) return null;
  return { id: user._id.toString(), email: user.email, firstName: user.firstName, lastName: user.lastName };
}

async function resolvePlanNames(shipments: LeanSubscriptionShipment[]): Promise<Map<string, string>> {
  const planIds = [...new Set(shipments.map((shipment) => shipment.planId.toString()))];
  const plans = await SubscriptionPlan.find({ _id: { $in: planIds } })
    .select("name")
    .lean<{ _id: Types.ObjectId; name: string }[]>();
  return new Map(plans.map((plan) => [plan._id.toString(), plan.name]));
}

async function resolveShipmentCustomers(
  shipments: LeanSubscriptionShipment[],
): Promise<Map<string, AdminShipmentCustomer | null>> {
  const userIds = [...new Set(shipments.map((shipment) => shipment.userId.toString()))];
  const users = await User.find({ _id: { $in: userIds } })
    .select("email firstName lastName")
    .lean<LeanUserForShipment[]>();
  const userById = new Map(users.map((user) => [user._id.toString(), user]));
  return new Map(
    shipments.map((shipment) => [
      shipment._id.toString(),
      toShipmentCustomer(userById.get(shipment.userId.toString())),
    ]),
  );
}

/**
 * `incident: true` trae las cajas que necesitan atención humana — falta la
 * edición del ciclo O no alcanzó el inventario. Son dos banderas distintas
 * pero una sola pregunta para quien opera el panel ("¿qué tengo que
 * revisar?"), igual que el filtro `incident` de órdenes.
 */
function buildFilter(input: ListAdminShipmentsInput): FilterQuery<SubscriptionShipmentAttrs> {
  const filter: FilterQuery<SubscriptionShipmentAttrs> = {};
  if (input.status) filter.status = input.status;
  if (input.planId) filter.planId = input.planId;
  if (input.cycleYear !== undefined) filter.cycleYear = input.cycleYear;
  if (input.cycleMonth !== undefined) filter.cycleMonth = input.cycleMonth;
  if (input.incident === true) {
    filter.$or = [{ editionIncident: true }, { inventoryIncident: true }];
  }
  if (input.incident === false) {
    filter.editionIncident = false;
    filter.inventoryIncident = false;
  }
  return filter;
}

async function listAdminShipments(
  input: ListAdminShipmentsInput,
): Promise<{ rows: AdminSubscriptionShipment[]; meta: PaginationMeta }> {
  const filter = buildFilter(input);

  const [shipments, total] = await Promise.all([
    SubscriptionShipment.find(filter)
      .sort(resolveSort(input.sort, ADMIN_SHIPMENT_SORT_FIELDS, "createdAt"))
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean<LeanSubscriptionShipment[]>(),
    SubscriptionShipment.countDocuments(filter),
  ]);

  const [planNameById, customerByShipmentId] = await Promise.all([
    resolvePlanNames(shipments),
    resolveShipmentCustomers(shipments),
  ]);

  const rows = shipments.map((shipment) =>
    buildAdminSubscriptionShipment(
      shipment,
      planNameById.get(shipment.planId.toString()) ?? "",
      customerByShipmentId.get(shipment._id.toString()) ?? null,
    ),
  );

  return { rows, meta: buildMeta(total, input) };
}

async function getAdminShipmentById(shipmentId: string): Promise<AdminSubscriptionShipment> {
  const shipment = await SubscriptionShipment.findById(shipmentId).lean<LeanSubscriptionShipment>();
  if (!shipment) throw new AppError("Envío no encontrado.", 404);

  const [plan, customer] = await Promise.all([
    SubscriptionPlan.findById(shipment.planId).select("name").lean<{ name: string }>(),
    User.findById(shipment.userId).select("email firstName lastName").lean<LeanUserForShipment>(),
  ]);

  return buildAdminSubscriptionShipment(shipment, plan?.name ?? "", toShipmentCustomer(customer ?? undefined));
}

export { listAdminShipments, getAdminShipmentById };
export type { ListAdminShipmentsInput };
