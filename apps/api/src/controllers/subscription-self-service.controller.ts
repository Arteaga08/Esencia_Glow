import type { Request, Response } from "express";
import type { SetupPaymentMethodResult, UpdatePaymentMethodResult } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { AppError } from "../utils/app-error.js";
import { resolveSubscriptionProvider } from "../services/subscription-provider.js";
import { getMySubscription } from "../services/subscription-me.service.js";
import {
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  undoCancelSubscription,
} from "../services/subscription-self-service.service.js";
import { changePlan } from "../services/subscription-plan-change.service.js";
import { confirmPaymentMethod, createPaymentMethodSetup } from "../services/subscription-payment-method.service.js";

/**
 * Autoservicio de la suscriptora (Milestone 1.7.3). Cada handler verifica el
 * proveedor ANTES de tocar cupo o estado — mismo criterio que
 * `subscription.controller.ts::start`: un entorno sin Stripe responde 503 sin
 * haber cambiado nada. Las operaciones que cambian la suscripción responden
 * con la suscripción ya actualizada (`{ subscription }`, la misma forma que
 * `GET /me`), así el front tiene una sola forma que pintar.
 */

function assertProviderConfigured(): void {
  if (!resolveSubscriptionProvider()) {
    throw new AppError("Las suscripciones no están configuradas.", 503);
  }
}

const INVOICE_RETRY_MESSAGES: Record<UpdatePaymentMethodResult["invoiceRetry"], string> = {
  not_needed: "Tu tarjeta se actualizó.",
  paid: "Tu tarjeta se actualizó y cobramos tu pago pendiente.",
  already_settled: "Tu tarjeta se actualizó. Tu pago pendiente ya estaba resuelto.",
  requires_action: "Tu tarjeta se actualizó, pero tu banco pide autorizar el pago pendiente. Inténtalo de nuevo o contacta a soporte.",
  declined: "Tu tarjeta se actualizó, pero el banco rechazó el pago pendiente. Prueba con otra tarjeta.",
};

const pause = asyncHandler(async (req: Request, res: Response) => {
  assertProviderConfigured();
  await pauseSubscription(req.user!.id);
  const subscription = await getMySubscription(req.user!.id);
  sendResponse(res, 200, "Tu suscripción está pausada.", { subscription });
});

const resume = asyncHandler(async (req: Request, res: Response) => {
  assertProviderConfigured();
  await resumeSubscription(req.user!.id);
  const subscription = await getMySubscription(req.user!.id);
  sendResponse(res, 200, "Tu suscripción se reanudó.", { subscription });
});

const cancel = asyncHandler(async (req: Request, res: Response) => {
  assertProviderConfigured();
  const outcome = await cancelSubscription(req.user!.id, req.body.reason);
  const subscription = await getMySubscription(req.user!.id);
  const message =
    outcome === "scheduled"
      ? "Tu suscripción se cancelará al final del período pagado."
      : "Tu suscripción fue cancelada.";
  sendResponse(res, 200, message, { subscription });
});

const undoCancel = asyncHandler(async (req: Request, res: Response) => {
  assertProviderConfigured();
  await undoCancelSubscription(req.user!.id);
  const subscription = await getMySubscription(req.user!.id);
  sendResponse(res, 200, "Tu suscripción seguirá activa.", { subscription });
});

const changeToPlan = asyncHandler(async (req: Request, res: Response) => {
  assertProviderConfigured();
  await changePlan(req.user!.id, req.body.planId);
  const subscription = await getMySubscription(req.user!.id);
  sendResponse(res, 200, "Tu plan se actualizó.", { subscription });
});

const setupPaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  assertProviderConfigured();
  const result = await createPaymentMethodSetup(req.user!.id);
  sendResponse(res, 201, "Listo para actualizar tu tarjeta.", result satisfies SetupPaymentMethodResult);
});

const updatePaymentMethod = asyncHandler(async (req: Request, res: Response) => {
  assertProviderConfigured();
  const result = await confirmPaymentMethod(req.user!.id, req.body.setupIntentId);
  sendResponse(res, 200, INVOICE_RETRY_MESSAGES[result.invoiceRetry], result satisfies UpdatePaymentMethodResult);
});

export { pause, resume, cancel, undoCancel, changeToPlan, setupPaymentMethod, updatePaymentMethod };
