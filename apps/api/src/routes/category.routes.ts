import { Router } from "express";
import * as catalogPublicController from "../controllers/catalog-public.controller.js";
import { validate } from "../middlewares/validate.js";
import { catalogRateLimiter } from "../middlewares/rate-limit.js";
import { slugParamSchema } from "../validators/media.validator.js";
import { publicCategoryQuerySchema } from "../validators/catalog-query.validator.js";

/** Router público de /api/v1/categories. Rate limit anti-scraping en las dos rutas. */
const router = Router();

router.get(
  "/",
  catalogRateLimiter,
  validate(publicCategoryQuerySchema, "query"),
  catalogPublicController.getCategoryTree,
);
router.get(
  "/:slug",
  catalogRateLimiter,
  validate(slugParamSchema, "params"),
  catalogPublicController.getCategory,
);

export { router as categoryRoutes };
