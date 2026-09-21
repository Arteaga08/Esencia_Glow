import { Router } from "express";
import * as homePublicController from "../controllers/home-public.controller.js";
import { catalogRateLimiter } from "../middlewares/rate-limit.js";

/** Router público de /api/v1/home. Rate limit anti-scraping, igual que el catálogo. */
const router = Router();

router.get("/", catalogRateLimiter, homePublicController.get);

export { router as homeRoutes };
