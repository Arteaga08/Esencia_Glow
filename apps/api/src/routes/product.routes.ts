import { Router } from "express";
import * as catalogPublicController from "../controllers/catalog-public.controller.js";
import { validate } from "../middlewares/validate.js";
import { catalogRateLimiter } from "../middlewares/rate-limit.js";
import { slugParamSchema } from "../validators/media.validator.js";
import { publicProductQuerySchema } from "../validators/catalog-query.validator.js";

/** Router público de /api/v1/products. Rate limit anti-scraping en las dos rutas. */
const router = Router();

router.get(
  "/",
  catalogRateLimiter,
  validate(publicProductQuerySchema, "query"),
  catalogPublicController.listProducts,
);
router.get(
  "/:slug",
  catalogRateLimiter,
  validate(slugParamSchema, "params"),
  catalogPublicController.getProduct,
);
router.get(
  "/:slug/availability",
  catalogRateLimiter,
  validate(slugParamSchema, "params"),
  catalogPublicController.getAvailability,
);

export { router as productRoutes };
