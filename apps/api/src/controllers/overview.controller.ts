import type { Request, Response } from "express";
import type { OverviewRange } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { getSalesSeries } from "../services/overview.service.js";

// `validate(overviewSalesQuerySchema)` ya rechazó cualquier valor fuera del
// enum y la ausencia de `range` — aquí siempre llega un valor válido.
const sales = asyncHandler(async (req: Request, res: Response) => {
  const range = req.query.range as OverviewRange;
  sendResponse(res, 200, "Serie de ventas.", await getSalesSeries(range));
});

export { sales };
