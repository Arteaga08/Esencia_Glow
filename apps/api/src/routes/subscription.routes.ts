import { Router } from "express";
import * as subscriptionController from "../controllers/subscription.controller.js";
import { protect } from "../middlewares/protect.js";
import { validate } from "../middlewares/validate.js";
import { subscribeRateLimiter } from "../middlewares/rate-limit.js";
import { startSubscriptionSchema } from "../validators/subscription.validator.js";

/**
 * `/api/v1/subscriptions` — solo el alta de la clienta (Fase 4 de 1.7.2a).
 * Sin `requireIdempotencyKey`: la idempotencia natural es el índice único
 * `{userId}` de `SubscriptionAccount`, resuelta en el service vía la rama
 * replay (ver §E del plan). La superficie admin vive en
 * `admin-subscription*.routes.ts`.
 */
const router = Router();

router.use(protect);

router.post("/", subscribeRateLimiter, validate(startSubscriptionSchema), subscriptionController.start);

export { router as subscriptionRoutes };
