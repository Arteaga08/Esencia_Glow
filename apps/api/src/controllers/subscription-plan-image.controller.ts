import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { AppError } from "../utils/app-error.js";
import * as planImageService from "../services/subscription-plan-image.service.js";
import * as subscriptionPlanService from "../services/subscription-plan.service.js";

const addPlanImages = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    throw new AppError("Debes adjuntar al menos una imagen", 400);
  }

  await planImageService.addPlanImages(
    req.params.id,
    files.map((file) => file.buffer),
    req.body.alt as string | undefined,
  );
  sendResponse(res, 201, "Imágenes agregadas.", await subscriptionPlanService.getPlanById(req.params.id));
});

const reorderPlanImages = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  await planImageService.reorderPlanImages(req.params.id, req.body.imageIds);
  sendResponse(res, 200, "Orden actualizado.", await subscriptionPlanService.getPlanById(req.params.id));
});

const removePlanImage = asyncHandler(async (req: Request<{ id: string; imageId: string }>, res: Response) => {
  await planImageService.removePlanImage(req.params.id, req.params.imageId);
  sendResponse(res, 200, "Imagen eliminada.", await subscriptionPlanService.getPlanById(req.params.id));
});

export { addPlanImages, reorderPlanImages, removePlanImage };
