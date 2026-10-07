import { Router } from "express";
import * as bundlePublicController from "../controllers/bundle-public.controller.js";
import { validate } from "../middlewares/validate.js";
import { catalogRateLimiter } from "../middlewares/rate-limit.js";
import { slugParamSchema } from "../validators/media.validator.js";
import { publicBundleFacetsQuerySchema, publicBundleQuerySchema } from "../validators/bundle-query.validator.js";

/** Router público de /api/v1/bundles. Rate limit anti-scraping, igual que products. */
const router = Router();

router.get(
  "/",
  catalogRateLimiter,
  validate(publicBundleQuerySchema, "query"),
  bundlePublicController.listBundles,
);
// Antes de "/:slug": si no, "facets" se leería como el slug de un paquete.
router.get(
  "/facets",
  catalogRateLimiter,
  validate(publicBundleFacetsQuerySchema, "query"),
  bundlePublicController.getBundleFacets,
);
router.get(
  "/:slug",
  catalogRateLimiter,
  validate(slugParamSchema, "params"),
  bundlePublicController.getBundle,
);
router.get(
  "/:slug/availability",
  catalogRateLimiter,
  validate(slugParamSchema, "params"),
  bundlePublicController.getAvailability,
);

export { router as bundleRoutes };
