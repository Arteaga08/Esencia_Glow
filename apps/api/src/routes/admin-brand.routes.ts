import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as brandController from "../controllers/brand.controller.js";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { objectIdParamSchema } from "../validators/media.validator.js";
import { createBrandSchema, updateBrandSchema } from "../validators/brand.validator.js";
import { listBrandsQuerySchema } from "../validators/catalog-query.validator.js";

/** Router de /api/v1/admin/brands. CRUD simple: solo nombre, sin imágenes. */
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

export { router as adminBrandRoutes };
