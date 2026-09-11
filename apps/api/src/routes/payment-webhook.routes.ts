import express, { Router } from "express";
import { webhookRateLimiter } from "../middlewares/rate-limit.js";
import { handleStripeWebhook } from "../controllers/payment-webhook.controller.js";

/**
 * `/api/v1/webhooks/stripe` — montada en `app.ts` ANTES de `express.json`
 * y del limiter global (ver docstring de `buildApp()`): la verificación de
 * firma de Stripe necesita el Buffer crudo del body, no el JSON parseado.
 * `express.raw` reemplaza a `express.json` SOLO en esta ruta.
 */
const router = Router();

router.post("/", webhookRateLimiter, express.raw({ type: "application/json", limit: "512kb" }), handleStripeWebhook);

export { router as paymentWebhookRoutes };
