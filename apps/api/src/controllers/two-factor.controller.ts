import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import * as twoFactorService from "../services/two-factor.service.js";

/**
 * Endpoints admin de configuración de 2FA. Montados con `protect` +
 * `restrictTo(ADMIN)` a nivel de router (ver routes/auth.routes.ts).
 */

const setup = asyncHandler(async (req: Request, res: Response) => {
  const result = await twoFactorService.setupTwoFactor(req.user!.id);
  sendResponse(res, 200, "Escanea el código QR con tu app de autenticación.", {
    otpauthUrl: result.otpauthUrl,
    qrCodeDataUrl: result.qrCodeDataUrl,
  });
});

const enable = asyncHandler(async (req: Request, res: Response) => {
  await twoFactorService.enableTwoFactor(req.user!.id, req.body.code);
  sendResponse(res, 200, "2FA activado.", null);
});

const disable = asyncHandler(async (req: Request, res: Response) => {
  await twoFactorService.disableTwoFactor(req.user!.id, req.body.code);
  sendResponse(res, 200, "2FA desactivado. Todas las sesiones activas fueron cerradas.", null);
});

export { setup, enable, disable };
