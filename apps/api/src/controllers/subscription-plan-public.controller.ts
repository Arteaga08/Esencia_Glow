import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import * as subscriptionPlanPublicService from "../services/subscription-plan-public.service.js";

const listPlans = asyncHandler(async (_req: Request, res: Response) => {
  const result = await subscriptionPlanPublicService.listPublicPlans();
  sendResponse(res, 200, "Planes obtenidos.", result);
});

const getPlan = asyncHandler(async (req: Request<{ slug: string }>, res: Response) => {
  const result = await subscriptionPlanPublicService.getPublicPlanBySlug(req.params.slug);
  sendResponse(res, 200, "Plan obtenido.", result);
});

export { listPlans, getPlan };
