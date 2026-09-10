import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { AppError } from "../utils/app-error.js";
import * as bundleImageService from "../services/bundle-image.service.js";
import * as bundleService from "../services/bundle.service.js";

const addBundleImages = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    throw new AppError("Debes adjuntar al menos una imagen", 400);
  }

  await bundleImageService.addBundleImages(
    req.params.id,
    files.map((file) => file.buffer),
    req.body.alt as string | undefined,
  );
  sendResponse(res, 201, "Imágenes agregadas.", await bundleService.getBundleById(req.params.id));
});

const reorderBundleImages = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await bundleImageService.reorderBundleImages(req.params.id, req.body.imageIds);
  sendResponse(res, 200, "Orden actualizado.", await bundleService.getBundleById(req.params.id));
});

const removeBundleImage = asyncHandler(
  async (req: Request<{ id: string; imageId: string }>, res: Response) => {
    await bundleImageService.removeBundleImage(req.params.id, req.params.imageId);
    sendResponse(res, 200, "Imagen eliminada.", await bundleService.getBundleById(req.params.id));
  },
);

export { addBundleImages, reorderBundleImages, removeBundleImage };
