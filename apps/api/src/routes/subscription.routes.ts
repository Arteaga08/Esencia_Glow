import { Router } from "express";
import * as subscriptionController from "../controllers/subscription.controller.js";
import * as selfServiceController from "../controllers/subscription-self-service.controller.js";
import { protect } from "../middlewares/protect.js";
import { requireCapability } from "../middlewares/require-capability.js";
import { validate } from "../middlewares/validate.js";
import {
  paymentMethodRateLimiter,
  subscribeRateLimiter,
  subscriptionManageRateLimiter,
} from "../middlewares/rate-limit.js";
import {
  cancelSubscriptionSchema,
  changePlanSchema,
  confirmPaymentMethodSchema,
  startSubscriptionSchema,
} from "../validators/subscription.validator.js";

/**
 * `/api/v1/subscriptions` — alta de la clienta (Fase 4 de 1.7.2a), lectura
 * de su propia suscripción (`GET /me`, 1.7.2b) y autoservicio (1.7.3).
 *
 * `requireCapability("subscriber")` (la primera vez que se monta) va SOLO en
 * pausar, deshacer la cancelación y cambiar de plan: son las acciones que
 * solo tienen sentido para quien tiene derechos de suscriptora (ACTIVE o
 * PAST_DUE). Reanudar, cancelar y la tarjeta NO la llevan a propósito — las
 * tres aceptan `PAUSED`, que no está entitled y recibiría un 403 en la
 * acción que más necesita. En todas, el service valida el estado exacto como
 * segunda defensa.
 *
 * Sin `requireIdempotencyKey`: la idempotencia natural es el índice único
 * `{userId}` de `SubscriptionAccount`, resuelta en el service vía la rama
 * replay (ver §E del plan). La superficie admin vive en
 * `admin-subscription*.routes.ts`.
 */
const router = Router();

router.use(protect);

router.get("/me", subscriptionController.me);
router.post("/", subscribeRateLimiter, validate(startSubscriptionSchema), subscriptionController.start);

router.post("/me/pause", subscriptionManageRateLimiter, requireCapability("subscriber"), selfServiceController.pause);
router.post("/me/resume", subscriptionManageRateLimiter, selfServiceController.resume);
router.post(
  "/me/cancel",
  subscriptionManageRateLimiter,
  validate(cancelSubscriptionSchema),
  selfServiceController.cancel,
);
router.post(
  "/me/undo-cancel",
  subscriptionManageRateLimiter,
  requireCapability("subscriber"),
  selfServiceController.undoCancel,
);
router.post(
  "/me/change-plan",
  subscriptionManageRateLimiter,
  requireCapability("subscriber"),
  validate(changePlanSchema),
  selfServiceController.changeToPlan,
);
router.post(
  "/me/payment-method/setup-intent",
  paymentMethodRateLimiter,
  selfServiceController.setupPaymentMethod,
);
router.put(
  "/me/payment-method",
  paymentMethodRateLimiter,
  validate(confirmPaymentMethodSchema),
  selfServiceController.updatePaymentMethod,
);

export { router as subscriptionRoutes };
