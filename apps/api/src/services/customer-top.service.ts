import {
  TopCustomersSort,
  UserRole,
  type TopCustomerRow,
  type TopCustomersPeriod,
  type TopCustomersResult,
} from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { resolvePeriodStart } from "../utils/resolve-period-start.js";
import { PURCHASED_ORDER_STATUSES } from "./customer-admin.service.js";

/**
 * Ranking de mejores clientes del panel (Milestone 2.6.1): top 10 por monto
 * o por pedidos dentro del periodo calendario en curso. Mismo criterio de
 * "comprado" que las métricas del listado (`PURCHASED_ORDER_STATUSES`), pero
 * acotado por `createdAt` del pedido.
 */
const TOP_CUSTOMERS_LIMIT = 10;

interface TopCustomersInput {
  period: TopCustomersPeriod;
  sortBy: TopCustomersSort;
}

/** El criterio elegido manda y el otro desempata; `_id` al final deja el
 * orden estable entre dos clientes idénticos. */
function resolveRankingSort(sortBy: TopCustomersSort): Record<string, 1 | -1> {
  return sortBy === TopCustomersSort.ORDERS
    ? { orderCount: -1, spentCents: -1, _id: 1 }
    : { spentCents: -1, orderCount: -1, _id: 1 };
}

async function getTopCustomers(input: TopCustomersInput, now: Date = new Date()): Promise<TopCustomersResult> {
  const from = resolvePeriodStart(input.period, now);

  const rows = await Order.aggregate<TopCustomerRow>([
    {
      $match: {
        status: { $in: PURCHASED_ORDER_STATUSES },
        createdAt: { $gte: from, $lte: now },
      },
    },
    { $group: { _id: "$userId", orderCount: { $sum: 1 }, spentCents: { $sum: "$totalCents" } } },
    // Solo clientes: un pedido de un admin (p. ej. una compra de prueba)
    // nunca entra al ranking. Va ANTES del $limit para que excluirlo no deje
    // el top con menos de 10 filas. Proyección explícita del usuario, nunca
    // `password`/`twoFactor.*`.
    {
      $lookup: {
        from: User.collection.name,
        localField: "_id",
        foreignField: "_id",
        pipeline: [{ $match: { role: UserRole.CUSTOMER } }, { $project: { email: 1, firstName: 1, lastName: 1 } }],
        as: "user",
      },
    },
    { $unwind: "$user" },
    { $sort: resolveRankingSort(input.sortBy) },
    { $limit: TOP_CUSTOMERS_LIMIT },
    {
      $project: {
        _id: 0,
        id: { $toString: "$_id" },
        firstName: "$user.firstName",
        lastName: "$user.lastName",
        email: "$user.email",
        orderCount: 1,
        spentCents: 1,
      },
    },
  ]);

  return { period: input.period, sortBy: input.sortBy, from: from.toISOString(), to: now.toISOString(), rows };
}

export { getTopCustomers, TOP_CUSTOMERS_LIMIT };
