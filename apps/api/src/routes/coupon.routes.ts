import { Router } from "express";
import * as couponController from "../controllers/coupon.controller.js";
import { protect } from "../middlewares/protect.js";
import { validate } from "../middlewares/validate.js";
import { couponValidateRateLimiter } from "../middlewares/rate-limit.js";
import { validateCouponSchema } from "../validators/coupon.validator.js";

/**
 * `/api/v1/coupons` (Milestone 3.7) — lo de la clienta en el checkout. El
 * canje no tiene ruta propia: ocurre dentro de `POST /orders`. La superficie
 * admin vive en `admin-coupon.routes.ts`.
 */
const router = Router();

router.use(protect);

router.post("/validate", couponValidateRateLimiter, validate(validateCouponSchema), couponController.validate);

export { router as couponRoutes };
