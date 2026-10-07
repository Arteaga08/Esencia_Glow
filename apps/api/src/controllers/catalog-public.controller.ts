import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import * as catalogPublicService from "../services/catalog-public.service.js";

const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query);
  const { category, brand, minPrice, maxPrice, bestseller, newArrival } = req.query as {
    category?: string;
    brand?: string[];
    minPrice?: number;
    maxPrice?: number;
    bestseller?: boolean;
    newArrival?: boolean;
  };
  const { products, meta } = await catalogPublicService.listPublicProducts({
    ...query,
    categorySlug: category,
    brands: brand,
    minPrice,
    maxPrice,
    bestseller,
    newArrival,
  });
  sendResponse(res, 200, "Productos obtenidos.", products, meta);
});

const getProductFacets = asyncHandler(async (req: Request, res: Response) => {
  const { category, bestseller } = req.query as { category?: string; bestseller?: boolean };
  const facets = await catalogPublicService.getPublicProductFacets(category, bestseller);
  sendResponse(res, 200, "Facetas obtenidas.", facets);
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

export { listProducts, getProductFacets, getProduct, getAvailability, getCategoryTree, getCategory };
