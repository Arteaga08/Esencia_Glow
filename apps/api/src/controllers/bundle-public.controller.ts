import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import * as bundlePublicService from "../services/bundle-public.service.js";

const listBundles = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query);
  const { bundles, meta } = await bundlePublicService.listPublicBundles(query);
  sendResponse(res, 200, "Paquetes obtenidos.", bundles, meta);
});

const getBundle = asyncHandler(async (req: Request<{ slug: string }>, res: Response) => {
  const bundle = await bundlePublicService.getPublicBundleBySlug(req.params.slug);
  sendResponse(res, 200, "Paquete obtenido.", bundle);
});

const getAvailability = asyncHandler(async (req: Request<{ slug: string }>, res: Response) => {
  const availability = await bundlePublicService.getPublicBundleAvailability(req.params.slug);
  sendResponse(res, 200, "Disponibilidad obtenida.", availability);
});

export { listBundles, getBundle, getAvailability };
