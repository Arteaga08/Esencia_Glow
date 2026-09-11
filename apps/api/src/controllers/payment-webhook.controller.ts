import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { AppError } from "../utils/app-error.js";
import { resolvePaymentProvider } from "../services/payment-provider.js";
import { processPaymentWebhook } from "../services/payment-webhook.service.js";

/**
 * `POST /webhooks/stripe` — server-to-server, sin sesión de usuario detrás:
 * su barrera es la firma, no `protect`/`validate` (ver
 * routes/payment-webhook.routes.ts, montado con body crudo antes de
 * `express.json`). `provider.parseWebhookEvent` hace la verificación de
 * firma + tolerancia y devuelve 400/503 según corresponda; cualquier otra
 * excepción del despacho (`processPaymentWebhook`) llega al errorHandler
 * global como 500, para que Stripe reintente la entrega.
 */
const handleStripeWebhook = asyncHandler(async (req: Request, res: Response) => {
  const provider = resolvePaymentProvider();
  if (!provider) {
    throw new AppError("Los pagos no están configurados.", 503);
  }

  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string" || !Buffer.isBuffer(req.body)) {
    throw new AppError("Firma de webhook inválida.", 400);
  }

  const event = provider.parseWebhookEvent(req.body, signature);
  await processPaymentWebhook(event, provider);

  sendResponse(res, 200, "Evento recibido.", { received: true });
});

export { handleStripeWebhook };
