import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as subscriptionShipmentController from "../controllers/subscription-shipment.controller.js";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { objectIdParamSchema } from "../validators/media.validator.js";
import { changeShipmentStatusSchema } from "../validators/subscription-shipment.validator.js";
import { listSubscriptionShipmentsQuerySchema } from "../validators/subscription-query.validator.js";

/**
 * Router de /api/v1/admin/subscription-shipments (Milestone 1.7.2b). La
 * transición es `PATCH /:id/status` y no un POST por acción (a diferencia de
 * `publish`/`unpublish` de ediciones): aquí no hay invariantes distintas por
 * arista, es una sola máquina de estados con un solo cuerpo de entrada —
 * mismo criterio que `PATCH /admin/orders/:id/status`.
 */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/", validate(listSubscriptionShipmentsQuerySchema, "query"), subscriptionShipmentController.list);
router.get("/:id", validate(objectIdParamSchema, "params"), subscriptionShipmentController.getOne);
router.patch(
  "/:id/status",
  validate(objectIdParamSchema, "params"),
  validate(changeShipmentStatusSchema),
  subscriptionShipmentController.changeStatus,
);

export { router as adminSubscriptionShipmentRoutes };
