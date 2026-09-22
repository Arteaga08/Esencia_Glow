import { Router } from "express";
import * as shippingController from "../controllers/shipping.controller.js";
import { protect } from "../middlewares/protect.js";
import { validate } from "../middlewares/validate.js";
import { shippingQuoteRateLimiter } from "../middlewares/rate-limit.js";
import { createShippingQuoteSchema } from "../validators/shipping.validator.js";

/**
 * `/api/v1/shipping`. Una llamada a un tercero (Skydropx en 1.9b; el stub no
 * lo es, pero se limita igual por consistencia) dentro del checkout — su
 * lentitud o caída no debe tumbar la sesión de compra (deadline y errores
 * explícitos en `shipping-quote.service.ts`). Rate limit propio por usuaria,
 * separado del de `/orders`.
 */
const router = Router();

router.post("/quotes", protect, shippingQuoteRateLimiter, validate(createShippingQuoteSchema), shippingController.createQuote);

export { router as shippingRoutes };
