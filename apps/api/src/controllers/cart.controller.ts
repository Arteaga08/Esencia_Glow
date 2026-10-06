import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { resolvePublicCart } from "../services/cart-public.service.js";

const resolveCart = asyncHandler(async (req: Request, res: Response) => {
  const lines = await resolvePublicCart(req.body.lines);
  sendResponse(res, 200, "Carrito actualizado.", lines);
});

export { resolveCart };
