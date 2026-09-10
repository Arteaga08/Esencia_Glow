import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { createShippingQuote } from "../services/shipping-quote.service.js";
import { buildPublicShippingQuote } from "../services/shipping-dto.js";

const createQuote = asyncHandler(async (req: Request, res: Response) => {
  const quote = await createShippingQuote({
    userId: req.user!.id,
    destination: req.body.destination,
    lines: req.body.lines,
  });
  sendResponse(res, 201, "Cotización de envío generada.", buildPublicShippingQuote(quote));
});

export { createQuote };
