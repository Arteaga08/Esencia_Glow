import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as bundleController from "../controllers/bundle.controller.js";
import * as bundleImageController from "../controllers/bundle-image.controller.js";
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
import { createBundleSchema, updateBundleSchema } from "../validators/bundle.validator.js";
import { listBundlesQuerySchema } from "../validators/bundle-query.validator.js";

/** Router de /api/v1/admin/bundles. Mismo patrón que admin-product.routes.ts. */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/", validate(listBundlesQuerySchema, "query"), bundleController.list);
router.post("/", validate(createBundleSchema), bundleController.create);
router.get("/:id", validate(objectIdParamSchema, "params"), bundleController.getOne);
router.patch(
  "/:id",
  validate(objectIdParamSchema, "params"),
  validate(updateBundleSchema),
  bundleController.update,
);
router.delete("/:id", validate(objectIdParamSchema, "params"), bundleController.archive);

router.post(
  "/:id/images",
  uploadRateLimiter,
  validate(objectIdParamSchema, "params"),
  uploadImageArray("images", 8),
  sanitizeMultipart,
  validate(uploadImagesBodySchema),
  bundleImageController.addBundleImages,
);
router.patch(
  "/:id/images/order",
  validate(objectIdParamSchema, "params"),
  validate(reorderImagesSchema),
  bundleImageController.reorderBundleImages,
);
router.delete(
  "/:id/images/:imageId",
  validate(imageParamsSchema, "params"),
  bundleImageController.removeBundleImage,
);

export { router as adminBundleRoutes };
