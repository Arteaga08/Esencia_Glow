import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as subscriptionPlanController from "../controllers/subscription-plan.controller.js";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { objectIdParamSchema } from "../validators/media.validator.js";
import {
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
} from "../validators/subscription-plan.validator.js";
import { listSubscriptionPlansQuerySchema } from "../validators/subscription-query.validator.js";

/**
 * Router de /api/v1/admin/subscription-plans (Milestone 1.7.1). `DELETE`
 * desactiva, nunca borra — ver subscription-plan.service.ts::deactivatePlan.
 */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/", validate(listSubscriptionPlansQuerySchema, "query"), subscriptionPlanController.list);
router.post("/", validate(createSubscriptionPlanSchema), subscriptionPlanController.create);
router.get("/:id", validate(objectIdParamSchema, "params"), subscriptionPlanController.getOne);
router.patch(
  "/:id",
  validate(objectIdParamSchema, "params"),
  validate(updateSubscriptionPlanSchema),
  subscriptionPlanController.update,
);
router.delete("/:id", validate(objectIdParamSchema, "params"), subscriptionPlanController.deactivate);

export { router as adminSubscriptionPlanRoutes };
