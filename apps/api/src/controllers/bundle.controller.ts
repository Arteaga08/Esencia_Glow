import type { Request, Response } from "express";
import type { BundleStatus } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import * as bundleService from "../services/bundle.service.js";

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query);
  const { status } = req.query as { status?: BundleStatus };
  const { bundles, meta } = await bundleService.listBundles({ ...query, status });
  sendResponse(res, 200, "Paquetes obtenidos.", bundles, meta);
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const bundle = await bundleService.createBundle(req.body);
  sendResponse(res, 201, "Paquete creado.", await bundleService.getBundleById(bundle.id));
});

const getOne = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const bundle = await bundleService.getBundleById(req.params.id);
  sendResponse(res, 200, "Paquete obtenido.", bundle);
});

const update = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await bundleService.updateBundle(req.params.id, req.body);
  sendResponse(res, 200, "Paquete actualizado.", await bundleService.getBundleById(req.params.id));
});

const archive = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await bundleService.archiveBundle(req.params.id);
  sendResponse(res, 200, "Paquete archivado.", null);
});

export { list, create, getOne, update, archive };
