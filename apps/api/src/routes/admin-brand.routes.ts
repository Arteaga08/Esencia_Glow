import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as brandController from "../controllers/brand.controller.js";
import * as catalogImageController from "../controllers/catalog-image.controller.js";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { uploadRateLimiter } from "../middlewares/rate-limit.js";
import { uploadSingleImage } from "../middlewares/upload-image.js";
import { sanitizeMultipart } from "../middlewares/sanitize-multipart.js";
import { objectIdParamSchema, uploadImagesBodySchema } from "../validators/media.validator.js";
import { createBrandSchema, updateBrandSchema } from "../validators/brand.validator.js";
import { listBrandsQuerySchema } from "../validators/catalog-query.validator.js";

/** Router de /api/v1/admin/brands. CRUD con logo opcional (una sola imagen, como la de categoría). */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/", validate(listBrandsQuerySchema, "query"), brandController.list);
router.post("/", validate(createBrandSchema), brandController.create);
router.get("/:id", validate(objectIdParamSchema, "params"), brandController.getOne);
router.patch(
  "/:id",
  validate(objectIdParamSchema, "params"),
  validate(updateBrandSchema),
  brandController.update,
);
router.delete("/:id", validate(objectIdParamSchema, "params"), brandController.remove);

// PUT: reemplazo idempotente del logo, igual que la imagen de categoría.
router.put(
  "/:id/logo",
  uploadRateLimiter,
  validate(objectIdParamSchema, "params"),
  uploadSingleImage("image"),
  sanitizeMultipart,
  validate(uploadImagesBodySchema),
  catalogImageController.setBrandLogo,
);
router.delete(
  "/:id/logo",
  validate(objectIdParamSchema, "params"),
  catalogImageController.removeBrandLogo,
);

export { router as adminBrandRoutes };
