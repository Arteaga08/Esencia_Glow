import type { Request, Response } from "express";
import { SubscriptionAction } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import * as enrollmentService from "../services/subscription-enrollment.service.js";
import { recordAudit } from "../services/audit.service.js";

const open = asyncHandler(async (req: Request, res: Response) => {
  const subscriptions = await enrollmentService.openEnrollment(req.body);

  await recordAudit({
    action: SubscriptionAction.SUBSCRIPTION_ENROLLMENT_OPENED,
    actorId: req.user!.id,
    metadata: { enrollmentClosesAt: subscriptions.enrollmentClosesAt ?? "" },
  });

  sendResponse(res, 200, "Inscripciones abiertas.", subscriptions);
});

const close = asyncHandler(async (req: Request, res: Response) => {
  const subscriptions = await enrollmentService.closeEnrollment();

  await recordAudit({
    action: SubscriptionAction.SUBSCRIPTION_ENROLLMENT_CLOSED,
    actorId: req.user!.id,
  });

  sendResponse(res, 200, "Inscripciones cerradas.", subscriptions);
});

export { open, close };
