import type { Request, Response } from "express";
import type { ProductStatus } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import * as productService from "../services/product.service.js";
import * as variantService from "../services/product-variant.service.js";

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query);
  const { categoryId, status, minPrice, maxPrice } = req.query as {
    categoryId?: string;
    status?: ProductStatus;
    minPrice?: number;
    maxPrice?: number;
  };
  const { products, meta } = await productService.listProducts({
    ...query,
    categoryId,
    status,
    minPrice,
    maxPrice,
  });
  sendResponse(res, 200, "Productos obtenidos.", products, meta);
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const product = await productService.createProduct(req.body);
  sendResponse(res, 201, "Producto creado.", await productService.getProductById(product.id));
});

const getOne = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const product = await productService.getProductById(req.params.id);
  sendResponse(res, 200, "Producto obtenido.", product);
});

const update = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await productService.updateProduct(req.params.id, req.body);
  sendResponse(res, 200, "Producto actualizado.", await productService.getProductById(req.params.id));
});

const archive = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await productService.archiveProduct(req.params.id);
  sendResponse(res, 200, "Producto archivado.", null);
});

const addVariant = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await variantService.addVariant(req.params.id, req.body);
  sendResponse(res, 201, "Variante creada.", await productService.getProductById(req.params.id));
});

const updateVariant = asyncHandler(
  async (req: Request<{ id: string; variantId: string }>, res: Response) => {
    await variantService.updateVariant(req.params.id, req.params.variantId, req.body);
    sendResponse(res, 200, "Variante actualizada.", await productService.getProductById(req.params.id));
  },
);

const removeVariant = asyncHandler(
  async (req: Request<{ id: string; variantId: string }>, res: Response) => {
    await variantService.removeVariant(req.params.id, req.params.variantId);
    sendResponse(res, 200, "Variante eliminada.", await productService.getProductById(req.params.id));
  },
);

export { list, create, getOne, update, archive, addVariant, updateVariant, removeVariant };
