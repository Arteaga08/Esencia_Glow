import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import * as bundlePublicService from "../services/bundle-public.service.js";

const listBundles = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query);
  const { minPrice, maxPrice } = req.query as { minPrice?: number; maxPrice?: number };
  const { bundles, meta } = await bundlePublicService.listPublicBundles({ ...query, minPrice, maxPrice });
  sendResponse(res, 200, "Paquetes obtenidos.", bundles, meta);
});

const getBundleFacets = asyncHandler(async (_req: Request, res: Response) => {
  const facets = await bundlePublicService.getPublicBundleFacets();
  sendResponse(res, 200, "Facetas obtenidas.", facets);
});

const getBundle = asyncHandler(async (req: Request<{ slug: string }>, res: Response) => {
  const bundle = await bundlePublicService.getPublicBundleBySlug(req.params.slug);
  sendResponse(res, 200, "Paquete obtenido.", bundle);
});

const getAvailability = asyncHandler(async (req: Request<{ slug: string }>, res: Response) => {
  const availability = await bundlePublicService.getPublicBundleAvailability(req.params.slug);
  sendResponse(res, 200, "Disponibilidad obtenida.", availability);
});

export { listBundles, getBundleFacets, getBundle, getAvailability };
