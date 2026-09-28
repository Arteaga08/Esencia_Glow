import type { Request, Response } from "express";
import type { SubscriptionStatus } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import {
  getAdminSubscriptionAccountById,
  getSubscriptionAccountActivity,
  listAdminSubscriptionAccounts,
} from "../services/subscription-account-admin.service.js";

/** Panel admin de Cuentas de suscripción (Milestone 2.7a) — solo lectura. */

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query);
  const { status, planId, attention } = req.query as {
    status?: SubscriptionStatus;
    planId?: string;
    attention?: boolean;
  };
  const { rows, meta } = await listAdminSubscriptionAccounts({ ...query, status, planId, attention });
  sendResponse(res, 200, "Cuentas de suscripción.", rows, meta);
});

const getOne = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  sendResponse(res, 200, "Cuenta de suscripción.", await getAdminSubscriptionAccountById(req.params.id));
});

const activity = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  sendResponse(res, 200, "Bitácora de la cuenta.", await getSubscriptionAccountActivity(req.params.id));
});

export { list, getOne, activity };
