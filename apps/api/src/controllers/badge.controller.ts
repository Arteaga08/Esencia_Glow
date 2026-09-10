import type { Request, Response } from "express";
import type { BadgeColor } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import * as badgeService from "../services/badge.service.js";

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query, "text");
  const { color } = req.query as { color?: BadgeColor };
  const { badges, meta } = await badgeService.listBadges({ ...query, color });
  sendResponse(res, 200, "Badges obtenidas.", badges, meta);
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const badge = await badgeService.createBadge(req.body);
  sendResponse(res, 201, "Badge creada.", await badgeService.getBadgeById(badge.id));
});

const getOne = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const badge = await badgeService.getBadgeById(req.params.id);
  sendResponse(res, 200, "Badge obtenida.", badge);
});

const update = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await badgeService.updateBadge(req.params.id, req.body);
  sendResponse(res, 200, "Badge actualizada.", await badgeService.getBadgeById(req.params.id));
});

const remove = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await badgeService.deleteBadge(req.params.id);
  sendResponse(res, 200, "Badge eliminada.", null);
});

export { list, create, getOne, update, remove };
