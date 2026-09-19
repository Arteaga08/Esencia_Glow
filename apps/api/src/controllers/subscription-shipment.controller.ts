import type { Request, Response } from "express";
import type { ShippingCarrier, SubscriptionShipmentStatus } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import { changeShipmentStatus } from "../services/subscription-shipment-admin.service.js";
import {
  getAdminShipmentById,
  listAdminShipments,
} from "../services/subscription-shipment-panel.service.js";

/** Panel de envíos de suscripción (Milestone 1.7.2b). La auditoría la escribe
 * el service (necesita el `from` real, que solo conoce dentro de su
 * transacción), a diferencia de los controllers de plan/edición. */

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query);
  const { status, planId, cycleYear, cycleMonth, incident } = req.query as {
    status?: SubscriptionShipmentStatus;
    planId?: string;
    cycleYear?: number;
    cycleMonth?: number;
    incident?: boolean;
  };
  const { rows, meta } = await listAdminShipments({ ...query, status, planId, cycleYear, cycleMonth, incident });
  sendResponse(res, 200, "Envíos de suscripción obtenidos.", rows, meta);
});

const getOne = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  sendResponse(res, 200, "Envío de suscripción obtenido.", await getAdminShipmentById(req.params.id));
});

const changeStatus = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const { status, carrier, trackingNumber } = req.body as {
    status: SubscriptionShipmentStatus;
    carrier?: ShippingCarrier;
    trackingNumber?: string;
  };
  await changeShipmentStatus({
    shipmentId: req.params.id,
    to: status,
    actor: "admin",
    carrier,
    trackingNumber,
  });
  sendResponse(res, 200, "Estado del envío actualizado.", await getAdminShipmentById(req.params.id));
});

export { list, getOne, changeStatus };
