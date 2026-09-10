import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as badgeController from "../controllers/badge.controller.js";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { objectIdParamSchema } from "../validators/media.validator.js";
import { createBadgeSchema, updateBadgeSchema } from "../validators/badge.validator.js";
import { listBadgesQuerySchema } from "../validators/catalog-query.validator.js";

/** Router de /api/v1/admin/badges. CRUD simple, sin imágenes ni jerarquía. */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/", validate(listBadgesQuerySchema, "query"), badgeController.list);
router.post("/", validate(createBadgeSchema), badgeController.create);
router.get("/:id", validate(objectIdParamSchema, "params"), badgeController.getOne);
router.patch(
  "/:id",
  validate(objectIdParamSchema, "params"),
  validate(updateBadgeSchema),
  badgeController.update,
);
router.delete("/:id", validate(objectIdParamSchema, "params"), badgeController.remove);

export { router as adminBadgeRoutes };
