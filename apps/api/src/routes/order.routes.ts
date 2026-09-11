import { Router } from "express";
import * as orderController from "../controllers/order.controller.js";
import { protect } from "../middlewares/protect.js";
import { validate } from "../middlewares/validate.js";
import { checkoutRateLimiter, paymentResumeRateLimiter } from "../middlewares/rate-limit.js";
import { requireIdempotencyKey } from "../middlewares/require-idempotency-key.js";
import { objectIdParamSchema } from "../validators/media.validator.js";
import { createOrderSchema, listMyOrdersQuerySchema } from "../validators/order.validator.js";

/**
 * `/api/v1/orders` — solo lo del cliente dueño de la orden. La superficie
 * admin vive en `admin-order.routes.ts` (ver plan de 1.5, próximo paso).
 */
const router = Router();

router.use(protect);

router.post(
  "/",
  checkoutRateLimiter,
  requireIdempotencyKey,
  validate(createOrderSchema),
  orderController.checkout,
);
router.get("/", validate(listMyOrdersQuerySchema, "query"), orderController.listMine);
router.get("/:id", validate(objectIdParamSchema, "params"), orderController.getMine);
router.post("/:id/cancel", validate(objectIdParamSchema, "params"), orderController.cancelMine);
router.post(
  "/:id/payment",
  paymentResumeRateLimiter,
  validate(objectIdParamSchema, "params"),
  orderController.resumePayment,
);

export { router as orderRoutes };
