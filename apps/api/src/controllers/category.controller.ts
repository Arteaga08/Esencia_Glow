import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import * as categoryService from "../services/category.service.js";

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query, "sortOrder");
  const { parentId, isActive } = req.query as { parentId?: string; isActive?: boolean };
  const { categories, meta } = await categoryService.listCategories({
    ...query,
    parentId,
    isActive,
  });
  sendResponse(res, 200, "Categorías obtenidas.", categories, meta);
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoryService.createCategory(req.body);
  sendResponse(res, 201, "Categoría creada.", await categoryService.getCategoryById(category.id));
});

const getOne = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const category = await categoryService.getCategoryById(req.params.id);
  sendResponse(res, 200, "Categoría obtenida.", category);
});

const update = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await categoryService.updateCategory(req.params.id, req.body);
  sendResponse(res, 200, "Categoría actualizada.", await categoryService.getCategoryById(req.params.id));
});

const remove = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await categoryService.deleteCategory(req.params.id);
  sendResponse(res, 200, "Categoría eliminada.", null);
});

export { list, create, getOne, update, remove };
