import type { Request, Response } from "express";
import type { ShipmentQueue } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import { listAdminShipments } from "../services/shipment-panel.service.js";

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query);
  const { queue } = req.query as { queue: ShipmentQueue };
  const { rows, meta } = await listAdminShipments({ ...query, queue });
  sendResponse(res, 200, "Envíos de tienda.", rows, meta);
});

export { list };
