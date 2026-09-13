import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as subscriptionEditionController from "../controllers/subscription-edition.controller.js";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { objectIdParamSchema } from "../validators/media.validator.js";
import {
  createSubscriptionEditionSchema,
  updateSubscriptionEditionSchema,
} from "../validators/subscription-edition.validator.js";
import { listSubscriptionEditionsQuerySchema } from "../validators/subscription-query.validator.js";

/**
 * Router de /api/v1/admin/subscription-editions (Milestone 1.7.1).
 * `publish`/`unpublish` como POST con sub-path, no `PATCH {status}`: son
 * operaciones con invariantes propias, mismo criterio que
 * `POST /orders/:id/cancel`.
 */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/", validate(listSubscriptionEditionsQuerySchema, "query"), subscriptionEditionController.list);
router.post("/", validate(createSubscriptionEditionSchema), subscriptionEditionController.create);
router.get("/:id", validate(objectIdParamSchema, "params"), subscriptionEditionController.getOne);
router.patch(
  "/:id",
  validate(objectIdParamSchema, "params"),
  validate(updateSubscriptionEditionSchema),
  subscriptionEditionController.update,
);
router.post("/:id/publish", validate(objectIdParamSchema, "params"), subscriptionEditionController.publish);
router.post("/:id/unpublish", validate(objectIdParamSchema, "params"), subscriptionEditionController.unpublish);
router.delete("/:id", validate(objectIdParamSchema, "params"), subscriptionEditionController.remove);

export { router as adminSubscriptionEditionRoutes };
