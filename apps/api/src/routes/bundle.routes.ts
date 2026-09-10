import { Router } from "express";
import * as bundlePublicController from "../controllers/bundle-public.controller.js";
import { validate } from "../middlewares/validate.js";
import { catalogRateLimiter } from "../middlewares/rate-limit.js";
import { slugParamSchema } from "../validators/media.validator.js";
import { publicBundleQuerySchema } from "../validators/bundle-query.validator.js";

/** Router público de /api/v1/bundles. Rate limit anti-scraping, igual que products. */
const router = Router();

router.get(
  "/",
  catalogRateLimiter,
  validate(publicBundleQuerySchema, "query"),
  bundlePublicController.listBundles,
);
router.get(
  "/:slug",
  catalogRateLimiter,
  validate(slugParamSchema, "params"),
  bundlePublicController.getBundle,
);

export { router as bundleRoutes };
