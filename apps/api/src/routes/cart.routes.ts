import { Router } from "express";
import * as cartController from "../controllers/cart.controller.js";
import { validate } from "../middlewares/validate.js";
import { cartResolveRateLimiter } from "../middlewares/rate-limit.js";
import { resolveCartSchema } from "../validators/cart.validator.js";

/**
 * `/api/v1/cart`. Lectura pública (sin sesión) del precio y la disponibilidad
 * de lo que la clienta lleva en su carrito del navegador. Es POST solo porque
 * el lote va en el body; no escribe nada.
 */
const router = Router();

router.post("/resolve", cartResolveRateLimiter, validate(resolveCartSchema), cartController.resolveCart);

export { router as cartRoutes };
