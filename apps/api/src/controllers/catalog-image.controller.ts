import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { AppError } from "../utils/app-error.js";
import * as catalogImageService from "../services/catalog-image.service.js";
import * as productService from "../services/product.service.js";
import * as categoryService from "../services/category.service.js";

const addProductImages = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    throw new AppError("Debes adjuntar al menos una imagen", 400);
  }

  await catalogImageService.addProductImages(
    req.params.id,
    files.map((file) => file.buffer),
    req.body.alt as string | undefined,
  );
  sendResponse(res, 201, "Imágenes agregadas.", await productService.getProductById(req.params.id));
});

const reorderProductImages = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await catalogImageService.reorderProductImages(req.params.id, req.body.imageIds);
  sendResponse(res, 200, "Orden actualizado.", await productService.getProductById(req.params.id));
});

const removeProductImage = asyncHandler(
  async (req: Request<{ id: string; imageId: string }>, res: Response) => {
    await catalogImageService.removeProductImage(req.params.id, req.params.imageId);
    sendResponse(res, 200, "Imagen eliminada.", await productService.getProductById(req.params.id));
  },
);

const setCategoryImage = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    throw new AppError("Debes adjuntar una imagen", 400);
  }

  await catalogImageService.setCategoryImage(req.params.id, file.buffer, req.body.alt as string | undefined);
  sendResponse(res, 200, "Imagen actualizada.", await categoryService.getCategoryById(req.params.id));
});

const removeCategoryImage = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await catalogImageService.removeCategoryImage(req.params.id);
  sendResponse(res, 200, "Imagen eliminada.", await categoryService.getCategoryById(req.params.id));
});

export {
  addProductImages,
  reorderProductImages,
  removeProductImage,
  setCategoryImage,
  removeCategoryImage,
};
