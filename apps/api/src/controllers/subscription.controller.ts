import type { Request, Response } from "express";
import type { StartSubscriptionResult } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { AppError } from "../utils/app-error.js";
import { resolveSubscriptionProvider } from "../services/subscription-provider.js";
import { startSubscriptionForUser } from "../services/subscription-start.service.js";

/** `POST /subscriptions` — mismo criterio que `order.controller.ts::checkout`:
 * el 503 se verifica ANTES de tocar cupo, para que un entorno sin Stripe
 * nunca queme un lugar del plan por cada intento. */
const start = asyncHandler(async (req: Request, res: Response) => {
  if (!resolveSubscriptionProvider()) {
    throw new AppError("Las suscripciones no están configuradas.", 503);
  }

  const result = await startSubscriptionForUser({
    userId: req.user!.id,
    planId: req.body.planId,
  });

  sendResponse(res, 201, "Suscripción iniciada.", result satisfies StartSubscriptionResult);
});

export { start };
