import type { Request, Response } from "express";
import { SubscriptionAction, type EditionStatus } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import { recordAudit } from "../services/audit.service.js";
import * as subscriptionEditionService from "../services/subscription-edition.service.js";
import { publishEdition, unpublishEdition } from "../services/subscription-edition-publish.service.js";

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query, "cycleYear");
  const { planId, cycleYear, cycleMonth, status } = req.query as {
    planId?: string;
    cycleYear?: number;
    cycleMonth?: number;
    status?: EditionStatus;
  };
  const { editions, meta } = await subscriptionEditionService.listEditions({
    ...query,
    planId,
    cycleYear,
    cycleMonth,
    status,
  });
  sendResponse(res, 200, "Ediciones de suscripción obtenidas.", editions, meta);
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const edition = await subscriptionEditionService.createEdition(req.body);
  await recordAudit({ action: SubscriptionAction.EDITION_CREATED, actorId: req.user!.id, targetId: edition.id });
  sendResponse(res, 201, "Edición de suscripción creada.", await subscriptionEditionService.getEditionById(edition.id));
});

const getOne = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const edition = await subscriptionEditionService.getEditionById(req.params.id);
  sendResponse(res, 200, "Edición de suscripción obtenida.", edition);
});

const update = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await subscriptionEditionService.updateEdition(req.params.id, req.body);
  await recordAudit({ action: SubscriptionAction.EDITION_UPDATED, actorId: req.user!.id, targetId: req.params.id });
  sendResponse(
    res,
    200,
    "Edición de suscripción actualizada.",
    await subscriptionEditionService.getEditionById(req.params.id),
  );
});

const publish = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await publishEdition(req.params.id, req.user!.id);
  await recordAudit({ action: SubscriptionAction.EDITION_PUBLISHED, actorId: req.user!.id, targetId: req.params.id });
  sendResponse(
    res,
    200,
    "Edición de suscripción publicada.",
    await subscriptionEditionService.getEditionById(req.params.id),
  );
});

const unpublish = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await unpublishEdition(req.params.id);
  await recordAudit({ action: SubscriptionAction.EDITION_UNPUBLISHED, actorId: req.user!.id, targetId: req.params.id });
  sendResponse(
    res,
    200,
    "Edición de suscripción despublicada.",
    await subscriptionEditionService.getEditionById(req.params.id),
  );
});

const remove = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await subscriptionEditionService.deleteEdition(req.params.id);
  await recordAudit({ action: SubscriptionAction.EDITION_DELETED, actorId: req.user!.id, targetId: req.params.id });
  sendResponse(res, 200, "Edición de suscripción eliminada.", null);
});

export { list, create, getOne, update, publish, unpublish, remove };
