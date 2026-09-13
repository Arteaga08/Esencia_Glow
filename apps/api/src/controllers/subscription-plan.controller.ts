import type { Request, Response } from "express";
import { SubscriptionAction } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import { recordAudit } from "../services/audit.service.js";
import * as subscriptionPlanService from "../services/subscription-plan.service.js";

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query, "sortOrder");
  const { isActive } = req.query as { isActive?: boolean };
  const { plans, meta } = await subscriptionPlanService.listPlans({ ...query, isActive });
  sendResponse(res, 200, "Planes de suscripción obtenidos.", plans, meta);
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const plan = await subscriptionPlanService.createPlan(req.body);
  await recordAudit({ action: SubscriptionAction.PLAN_CREATED, actorId: req.user!.id, targetId: plan.id });
  sendResponse(res, 201, "Plan de suscripción creado.", await subscriptionPlanService.getPlanById(plan.id));
});

const getOne = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const plan = await subscriptionPlanService.getPlanById(req.params.id);
  sendResponse(res, 200, "Plan de suscripción obtenido.", plan);
});

const update = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await subscriptionPlanService.updatePlan(req.params.id, req.body);
  await recordAudit({ action: SubscriptionAction.PLAN_UPDATED, actorId: req.user!.id, targetId: req.params.id });
  sendResponse(res, 200, "Plan de suscripción actualizado.", await subscriptionPlanService.getPlanById(req.params.id));
});

const deactivate = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await subscriptionPlanService.deactivatePlan(req.params.id);
  await recordAudit({ action: SubscriptionAction.PLAN_DEACTIVATED, actorId: req.user!.id, targetId: req.params.id });
  sendResponse(res, 200, "Plan de suscripción desactivado.", await subscriptionPlanService.getPlanById(req.params.id));
});

export { list, create, getOne, update, deactivate };
