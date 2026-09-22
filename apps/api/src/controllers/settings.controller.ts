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
  // `section` identifica QUÉ sección cambió (las 4 comparten la misma acción).
  await recordAudit({
    action: InventoryAction.SETTINGS_UPDATED,
    actorId: req.user!.id,
    metadata: { section: "inventory", ...(req.body as Record<string, number>) },
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
    metadata: { section: "commerce", ...(req.body as Record<string, number>) },
  });

  sendResponse(res, 200, "Configuración de comercio actualizada.", commerce);
});

/** Mismo `InventoryAction.SETTINGS_UPDATED` genérico que las demás secciones. */
const updatePayments = asyncHandler(async (req: Request, res: Response) => {
  const payments = await settingsService.updatePaymentSettings(req.body);

  await recordAudit({
    action: InventoryAction.SETTINGS_UPDATED,
    actorId: req.user!.id,
    metadata: { section: "payments", ...(req.body as Record<string, number>) },
  });

  sendResponse(res, 200, "Configuración de pagos actualizada.", payments);
});

/** Mismo `InventoryAction.SETTINGS_UPDATED` genérico que las demás secciones
 * — este PATCH solo toca `billingAnchorDay`, nunca la ventana de
 * inscripciones (ver subscription-enrollment.ts). */
const updateSubscriptions = asyncHandler(async (req: Request, res: Response) => {
  const subscriptions = await settingsService.updateSubscriptionSettings(req.body);

  await recordAudit({
    action: InventoryAction.SETTINGS_UPDATED,
    actorId: req.user!.id,
    metadata: { section: "subscriptions", ...(req.body as Record<string, number>) },
  });

  sendResponse(res, 200, "Configuración de suscripciones actualizada.", subscriptions);
});

/** Mismo `InventoryAction.SETTINGS_UPDATED` genérico. La auditoría NO lleva
 * la dirección (nombre, teléfono, calle): solo qué campo cambió. */
const updateShipping = asyncHandler(async (req: Request, res: Response) => {
  const shipping = await settingsService.updateShippingSettings(req.body);

  await recordAudit({
    action: InventoryAction.SETTINGS_UPDATED,
    actorId: req.user!.id,
    metadata: { section: "shipping", field: "origin" },
  });

  sendResponse(res, 200, "Configuración de envíos actualizada.", shipping);
});

export { get, updateInventory, updateCommerce, updatePayments, updateSubscriptions, updateShipping };
