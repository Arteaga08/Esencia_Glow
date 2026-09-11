import type { Request, Response } from "express";
import { InventoryAction } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import * as settingsService from "../services/settings.service.js";
import { recordAudit } from "../services/audit.service.js";

const get = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await settingsService.getSettings();
  sendResponse(res, 200, "Configuración obtenida.", settings);
});

const updateInventory = asyncHandler(async (req: Request, res: Response) => {
  const inventory = await settingsService.updateInventorySettings(req.body);

  // Sin `targetId`: el singleton usa `_id: "global"` (string), no un
  // ObjectId — el `req.body` ya validado por Joi es la metadata útil.
  await recordAudit({
    action: InventoryAction.SETTINGS_UPDATED,
    actorId: req.user!.id,
    metadata: req.body as Record<string, number>,
  });

  sendResponse(res, 200, "Configuración de inventario actualizada.", inventory);
});

/** Mismo `InventoryAction.SETTINGS_UPDATED` que la sección inventory: es la
 * acción genérica "se actualizó el singleton de Settings", no una acción
 * exclusiva de inventario (ver InventoryAction). */
const updateCommerce = asyncHandler(async (req: Request, res: Response) => {
  const commerce = await settingsService.updateCommerceSettings(req.body);

  await recordAudit({
    action: InventoryAction.SETTINGS_UPDATED,
    actorId: req.user!.id,
    metadata: req.body as Record<string, number>,
  });

  sendResponse(res, 200, "Configuración de comercio actualizada.", commerce);
});

export { get, updateInventory, updateCommerce };
