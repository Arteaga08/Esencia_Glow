import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as productController from "../controllers/product.controller.js";
import * as catalogImageController from "../controllers/catalog-image.controller.js";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { uploadRateLimiter } from "../middlewares/rate-limit.js";
import { uploadImageArray } from "../middlewares/upload-image.js";
import { sanitizeMultipart } from "../middlewares/sanitize-multipart.js";
import {
  objectIdParamSchema,
  imageParamsSchema,
  variantParamsSchema,
  uploadImagesBodySchema,
  reorderImagesSchema,
} from "../validators/media.validator.js";
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
} from "../validators/product.validator.js";
import { listProductsQuerySchema } from "../validators/catalog-query.validator.js";

/**
 * Router de /api/v1/admin/products. Las rutas de CRUD no llevan rate limiter
 * (auth + rol es la barrera). Las de imagen sí (`uploadRateLimiter`): ahí el
 * costo es CPU de `sharp`, no una consulta — ver middlewares/rate-limit.ts.
 */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/", validate(listProductsQuerySchema, "query"), productController.list);
router.post("/", validate(createProductSchema), productController.create);
router.get("/:id", validate(objectIdParamSchema, "params"), productController.getOne);
router.patch(
  "/:id",
  validate(objectIdParamSchema, "params"),
  validate(updateProductSchema),
  productController.update,
);
router.delete("/:id", validate(objectIdParamSchema, "params"), productController.archive);

router.post(
  "/:id/variants",
  validate(objectIdParamSchema, "params"),
  validate(createVariantSchema),
  productController.addVariant,
);
router.patch(
  "/:id/variants/:variantId",
  validate(variantParamsSchema, "params"),
  validate(updateVariantSchema),
  productController.updateVariant,
);
router.delete(
  "/:id/variants/:variantId",
  validate(variantParamsSchema, "params"),
  productController.removeVariant,
);

router.post(
  "/:id/images",
  uploadRateLimiter,
  validate(objectIdParamSchema, "params"),
  uploadImageArray("images", 8),
  sanitizeMultipart,
  validate(uploadImagesBodySchema),
  catalogImageController.addProductImages,
);
router.patch(
  "/:id/images/order",
  validate(objectIdParamSchema, "params"),
  validate(reorderImagesSchema),
  catalogImageController.reorderProductImages,
);
router.delete(
  "/:id/images/:imageId",
  validate(imageParamsSchema, "params"),
  catalogImageController.removeProductImage,
);

export { router as adminProductRoutes };
