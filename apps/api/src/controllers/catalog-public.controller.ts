import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import * as catalogPublicService from "../services/catalog-public.service.js";

const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query);
  const { category, minPrice, maxPrice } = req.query as {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
  };
  const { products, meta } = await catalogPublicService.listPublicProducts({
    ...query,
    categorySlug: category,
    minPrice,
    maxPrice,
  });
  sendResponse(res, 200, "Productos obtenidos.", products, meta);
});

const getProduct = asyncHandler(async (req: Request<{ slug: string }>, res: Response) => {
  const product = await catalogPublicService.getPublicProductBySlug(req.params.slug);
  sendResponse(res, 200, "Producto obtenido.", product);
});

const getAvailability = asyncHandler(async (req: Request<{ slug: string }>, res: Response) => {
  const availability = await catalogPublicService.getPublicVariantAvailability(req.params.slug);
  sendResponse(res, 200, "Disponibilidad obtenida.", availability);
});

const getCategoryTree = asyncHandler(async (_req: Request, res: Response) => {
  const tree = await catalogPublicService.getPublicCategoryTree();
  sendResponse(res, 200, "Categorías obtenidas.", tree);
});

const getCategory = asyncHandler(async (req: Request<{ slug: string }>, res: Response) => {
  const category = await catalogPublicService.getPublicCategoryBySlug(req.params.slug);
  sendResponse(res, 200, "Categoría obtenida.", category);
});

export { listProducts, getProduct, getAvailability, getCategoryTree, getCategory };
