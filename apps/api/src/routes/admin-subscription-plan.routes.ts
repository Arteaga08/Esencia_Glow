import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as subscriptionPlanController from "../controllers/subscription-plan.controller.js";
import * as planImageController from "../controllers/subscription-plan-image.controller.js";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { uploadRateLimiter } from "../middlewares/rate-limit.js";
import { uploadImageArray } from "../middlewares/upload-image.js";
import { sanitizeMultipart } from "../middlewares/sanitize-multipart.js";
import {
  objectIdParamSchema,
  imageParamsSchema,
  uploadImagesBodySchema,
  reorderImagesSchema,
} from "../validators/media.validator.js";
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

router.post(
  "/:id/images",
  uploadRateLimiter,
  validate(objectIdParamSchema, "params"),
  uploadImageArray("images", 8),
  sanitizeMultipart,
  validate(uploadImagesBodySchema),
  planImageController.addPlanImages,
);
router.patch(
  "/:id/images/order",
  validate(objectIdParamSchema, "params"),
  validate(reorderImagesSchema),
  planImageController.reorderPlanImages,
);
router.delete(
  "/:id/images/:imageId",
  validate(imageParamsSchema, "params"),
  planImageController.removePlanImage,
);

export { router as adminSubscriptionPlanRoutes };
