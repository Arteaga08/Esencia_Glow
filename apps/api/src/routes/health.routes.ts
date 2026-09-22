import { Router } from "express";
import { liveness, readiness } from "../controllers/health.controller.js";

const router = Router();

router.get("/health", liveness);
router.get("/health/ready", readiness);

export default router;
