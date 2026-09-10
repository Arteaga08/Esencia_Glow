import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as categoryController from "../controllers/category.controller.js";
import * as catalogImageController from "../controllers/catalog-image.controller.js";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { uploadRateLimiter } from "../middlewares/rate-limit.js";
import { uploadSingleImage } from "../middlewares/upload-image.js";
import { sanitizeMultipart } from "../middlewares/sanitize-multipart.js";
import { objectIdParamSchema, uploadImagesBodySchema } from "../validators/media.validator.js";
import { createCategorySchema, updateCategorySchema } from "../validators/category.validator.js";
import { listCategoriesQuerySchema } from "../validators/catalog-query.validator.js";

/**
 * Router de /api/v1/admin/categories. El CRUD no lleva rate limiter propio:
 * la barrera es auth + rol (mismo criterio que el resto de rutas admin). La
 * ruta de imagen sí lleva `uploadRateLimiter` — ahí el costo es CPU de
 * `sharp`, no una consulta (ver middlewares/rate-limit.ts).
 */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/", validate(listCategoriesQuerySchema, "query"), categoryController.list);
router.post("/", validate(createCategorySchema), categoryController.create);
router.get("/:id", validate(objectIdParamSchema, "params"), categoryController.getOne);
router.patch(
  "/:id",
  validate(objectIdParamSchema, "params"),
  validate(updateCategorySchema),
  categoryController.update,
);
router.delete("/:id", validate(objectIdParamSchema, "params"), categoryController.remove);

// PUT: reemplazo idempotente de un recurso único (a diferencia de las
// imágenes de producto, que se agregan a una colección con POST).
router.put(
  "/:id/image",
  uploadRateLimiter,
  validate(objectIdParamSchema, "params"),
  uploadSingleImage("image"),
  sanitizeMultipart,
  validate(uploadImagesBodySchema),
  catalogImageController.setCategoryImage,
);
router.delete(
  "/:id/image",
  validate(objectIdParamSchema, "params"),
  catalogImageController.removeCategoryImage,
);

export { router as adminCategoryRoutes };
