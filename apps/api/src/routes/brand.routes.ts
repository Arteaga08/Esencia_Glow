import { Router } from "express";
import * as brandPublicController from "../controllers/brand-public.controller.js";
import { validate } from "../middlewares/validate.js";
import { catalogRateLimiter } from "../middlewares/rate-limit.js";
import { slugParamSchema } from "../validators/media.validator.js";

/** Router público de /api/v1/brands. Rate limit anti-scraping, igual que el catálogo. */
const router = Router();

router.get("/", catalogRateLimiter, brandPublicController.list);
router.get("/:slug", catalogRateLimiter, validate(slugParamSchema, "params"), brandPublicController.getOne);

export { router as brandRoutes };
