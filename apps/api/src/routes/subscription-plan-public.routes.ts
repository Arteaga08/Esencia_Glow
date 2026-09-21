import { Router } from "express";
import * as subscriptionPlanPublicController from "../controllers/subscription-plan-public.controller.js";
import { validate } from "../middlewares/validate.js";
import { catalogRateLimiter } from "../middlewares/rate-limit.js";
import { slugParamSchema } from "../validators/media.validator.js";

/**
 * Router público de `/api/v1/subscription-plans` (Milestone 1.7.3). Router
 * PROPIO, no un `GET` más en `subscription.routes.ts`: ese lleva
 * `router.use(protect)` y el catálogo tiene que ser visible SIN sesión, antes
 * de que la visitante se registre. Rate limit anti-scraping, igual que
 * products y bundles.
 */
const router = Router();

router.get("/", catalogRateLimiter, subscriptionPlanPublicController.listPlans);
router.get(
  "/:slug",
  catalogRateLimiter,
  validate(slugParamSchema, "params"),
  subscriptionPlanPublicController.getPlan,
);

export { router as subscriptionPlanPublicRoutes };
