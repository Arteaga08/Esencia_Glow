import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { previewCoupon } from "../services/coupon-preview.service.js";

const validate = asyncHandler(async (req: Request, res: Response) => {
  const preview = await previewCoupon({ code: req.body.code, lines: req.body.lines, userId: req.user!.id });
  sendResponse(res, 200, "Cupón válido.", preview);
});

export { validate };
