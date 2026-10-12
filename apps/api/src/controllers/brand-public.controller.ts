import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import * as brandPublicService from "../services/brand-public.service.js";

const list = asyncHandler(async (_req: Request, res: Response) => {
  sendResponse(res, 200, "Marcas obtenidas.", await brandPublicService.listHomeBrands());
});

const getOne = asyncHandler(async (req: Request<{ slug: string }>, res: Response) => {
  sendResponse(res, 200, "Marca obtenida.", await brandPublicService.getPublicBrandBySlug(req.params.slug));
});

export { list, getOne };
