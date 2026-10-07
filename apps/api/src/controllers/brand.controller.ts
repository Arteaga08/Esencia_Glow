import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import * as brandService from "../services/brand.service.js";

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query, "name");
  const { brands, meta } = await brandService.listBrands(query);
  sendResponse(res, 200, "Marcas obtenidas.", brands, meta);
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const brand = await brandService.createBrand(req.body);
  sendResponse(res, 201, "Marca creada.", await brandService.getBrandById(brand.id));
});

const getOne = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const brand = await brandService.getBrandById(req.params.id);
  sendResponse(res, 200, "Marca obtenida.", brand);
});

const update = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await brandService.updateBrand(req.params.id, req.body);
  sendResponse(res, 200, "Marca actualizada.", await brandService.getBrandById(req.params.id));
});

const remove = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await brandService.deleteBrand(req.params.id);
  sendResponse(res, 200, "Marca eliminada.", null);
});

export { list, create, getOne, update, remove };
