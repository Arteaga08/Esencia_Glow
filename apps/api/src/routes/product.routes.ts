import { Router } from "express";
import * as catalogPublicController from "../controllers/catalog-public.controller.js";
import { validate } from "../middlewares/validate.js";
import { catalogRateLimiter } from "../middlewares/rate-limit.js";
import { slugParamSchema } from "../validators/media.validator.js";
import { publicProductQuerySchema, publicProductFacetsQuerySchema } from "../validators/catalog-query.validator.js";

/** Router público de /api/v1/products. Rate limit anti-scraping en todas las rutas. */
const router = Router();

router.get(
  "/",
  catalogRateLimiter,
  validate(publicProductQuerySchema, "query"),
  catalogPublicController.listProducts,
);
// Antes de "/:slug": si no, "facets" se leería como el slug de un producto.
router.get(
  "/facets",
  catalogRateLimiter,
  validate(publicProductFacetsQuerySchema, "query"),
  catalogPublicController.getProductFacets,
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
