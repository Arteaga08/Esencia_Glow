import { Router } from "express";
import * as shippingController from "../controllers/shipping.controller.js";
import { protect } from "../middlewares/protect.js";
import { validate } from "../middlewares/validate.js";
import { createRateLimiter } from "../middlewares/rate-limit.js";
import { createShippingQuoteSchema } from "../validators/shipping.validator.js";

/**
 * `/api/v1/shipping`. Una llamada a un tercero (Skydropx en 1.9; el stub de
 * 1.5 no lo es, pero se limita igual por consistencia) dentro del checkout —
 * su lentitud o caída no debe tumbar la sesión de compra. Rate limit propio,
 * separado del de `/orders`: cotizar es más barato y más frecuente (el
 * cliente puede cotizar varias veces antes de decidir) que crear una orden.
 */
const quoteRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: "Demasiadas cotizaciones de envío, intenta de nuevo más tarde.",
});

const router = Router();

router.post("/quotes", protect, quoteRateLimiter, validate(createShippingQuoteSchema), shippingController.createQuote);

export { router as shippingRoutes };
