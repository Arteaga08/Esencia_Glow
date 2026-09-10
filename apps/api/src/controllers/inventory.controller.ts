import type { Request, Response } from "express";
import { InventoryAction, type ReservationStatus } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import * as inventoryService from "../services/inventory.service.js";
import * as reservationService from "../services/stock-reservation.service.js";
import { getSettings } from "../services/settings.service.js";
import { recordAudit } from "../services/audit.service.js";
import { buildAdminInventoryRow, buildAdminReservation } from "../services/inventory-dto.js";

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query, "updatedAt");
  const { productId, lowStock } = req.query as { productId?: string; lowStock?: boolean };
  const settings = await getSettings();

  const { rows, meta } = await inventoryService.listInventory(
    { ...query, productId, lowStock },
    settings.inventory.lowStockThreshold,
  );
  sendResponse(res, 200, "Inventario obtenido.", rows.map(buildAdminInventoryRow), meta);
});

const getOne = asyncHandler(async (req: Request<{ variantId: string }>, res: Response) => {
  const row = await inventoryService.getByVariantId(req.params.variantId);
  sendResponse(res, 200, "Fila de inventario obtenida.", buildAdminInventoryRow(row));
});

const adjust = asyncHandler(async (req: Request<{ variantId: string }>, res: Response) => {
  const { delta, reason, expectedOnHand } = req.body as {
    delta: number;
    reason: string;
    expectedOnHand?: number;
  };

  const row = await inventoryService.adjustStock({
    variantId: req.params.variantId,
    delta,
    expectedOnHand,
  });

  await recordAudit({
    action: InventoryAction.STOCK_ADJUSTED,
    actorId: req.user!.id,
    targetId: row._id,
    metadata: { delta, reason, onHand: row.onHand },
  });

  sendResponse(res, 200, "Inventario ajustado.", buildAdminInventoryRow(row));
});

const listReservations = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query, "createdAt");
  const { status } = req.query as { status?: ReservationStatus };
  const { rows, meta } = await reservationService.listReservations({ ...query, status });
  sendResponse(res, 200, "Reservas obtenidas.", rows.map(buildAdminReservation), meta);
});

const forceRelease = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const reservation = await reservationService.releaseReservation(req.params.id);

  await recordAudit({
    action: InventoryAction.RESERVATION_RELEASED,
    actorId: req.user!.id,
    targetId: reservation._id,
    metadata: { cartRef: reservation.cartRef },
  });

  sendResponse(res, 200, "Reserva liberada.", buildAdminReservation(reservation));
});

export { list, getOne, adjust, listReservations, forceRelease };
