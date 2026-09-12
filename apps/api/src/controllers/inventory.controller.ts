import type { Request, Response } from "express";
import type { StockStatus} from "@esencia-glow/shared";
import { InventoryAction, type ReservationStatus } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { parseListQuery } from "../utils/parse-list-query.js";
import * as inventoryService from "../services/inventory.service.js";
import * as reservationService from "../services/stock-reservation.service.js";
import * as panelService from "../services/inventory-panel.service.js";
import { getSettings } from "../services/settings.service.js";
import { recordAudit } from "../services/audit.service.js";
import { buildAdminInventoryRow, buildAdminReservation } from "../services/inventory-dto.js";

const list = asyncHandler(async (req: Request, res: Response) => {
  const query = parseListQuery(req.query, "name");
  const { status } = req.query as { status?: StockStatus };
  const settings = await getSettings();

  const { items, statusCounts, meta } = await panelService.listInventoryPanel(
    { ...query, status },
    settings.inventory.lowStockThreshold,
  );
  sendResponse(res, 200, "Inventario obtenido.", { items, statusCounts }, meta);
});

const getProductDetail = asyncHandler(async (req: Request<{ productId: string }>, res: Response) => {
  const settings = await getSettings();
  const detail = await panelService.getProductInventoryDetail(
    req.params.productId,
    settings.inventory.lowStockThreshold,
  );
  sendResponse(res, 200, "Detalle de inventario obtenido.", detail);
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const { productId, variantId, onHand, lowStockThreshold } = req.body as {
    productId: string;
    variantId: string;
    onHand: number;
    lowStockThreshold?: number;
  };

  const row = await inventoryService.createInventoryItem({ productId, variantId, onHand, lowStockThreshold });

  await recordAudit({
    action: InventoryAction.INVENTORY_ITEM_CREATED,
    actorId: req.user!.id,
    targetId: row._id,
    metadata: { productId, onHand },
  });

  const settings = await getSettings();
  sendResponse(res, 201, "Fila de inventario creada.", buildAdminInventoryRow(row, settings.inventory.lowStockThreshold));
});

const getOne = asyncHandler(async (req: Request<{ variantId: string }>, res: Response) => {
  const row = await inventoryService.getByVariantId(req.params.variantId);
  const settings = await getSettings();
  sendResponse(res, 200, "Fila de inventario obtenida.", buildAdminInventoryRow(row, settings.inventory.lowStockThreshold));
});

const adjustStock = asyncHandler(async (req: Request<{ variantId: string }>, res: Response) => {
  const { delta, onHand, reason, expectedOnHand } = req.body as {
    delta?: number;
    onHand?: number;
    reason?: string;
    expectedOnHand?: number;
  };

  const { row, before, after } = await inventoryService.adjustStock({
    variantId: req.params.variantId,
    delta,
    onHand,
    expectedOnHand,
  });

  await recordAudit({
    action: InventoryAction.STOCK_ADJUSTED,
    actorId: req.user!.id,
    targetId: row._id,
    metadata: {
      mode: delta !== undefined ? "delta" : "recount",
      ...(delta !== undefined ? { delta } : {}),
      onHandBefore: before,
      onHandAfter: after,
      ...(reason ? { reason } : {}),
    },
  });

  const settings = await getSettings();
  sendResponse(res, 200, "Inventario ajustado.", buildAdminInventoryRow(row, settings.inventory.lowStockThreshold));
});

const updateThreshold = asyncHandler(async (req: Request<{ variantId: string }>, res: Response) => {
  const { lowStockThreshold } = req.body as { lowStockThreshold: number | null };

  const row = await inventoryService.updateLowStockThreshold(req.params.variantId, lowStockThreshold);

  await recordAudit({
    action: InventoryAction.LOW_STOCK_THRESHOLD_UPDATED,
    actorId: req.user!.id,
    targetId: row._id,
    metadata: { lowStockThreshold: lowStockThreshold ?? "default" },
  });

  const settings = await getSettings();
  sendResponse(res, 200, "Umbral actualizado.", buildAdminInventoryRow(row, settings.inventory.lowStockThreshold));
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

export {
  list,
  getProductDetail,
  create,
  getOne,
  adjustStock,
  updateThreshold,
  listReservations,
  forceRelease,
};
