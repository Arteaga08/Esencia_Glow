import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/app-error.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { ACCESS_COOKIE_NAME } from "../utils/cookies.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/async-handler.js";

/**
 * Verifica el access token de la cookie httpOnly y carga `req.user`. Rechaza
 * si `sessionVersion` del token no coincide con el actual del usuario (sesión
 * revocada en masa) o si la contraseña cambió después de que el token fue
 * emitido — ambos casos matan de inmediato un access token que, al ser JWT,
 * no es revocable por sí mismo (BACKEND_SECURITY_GUIDELINES.md §3).
 */
const protect = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[ACCESS_COOKIE_NAME] as string | undefined;
  if (!token) {
    throw new AppError("No autenticado", 401);
  }

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub);

  if (!user) {
    throw new AppError("No autenticado", 401);
  }

  if (user.sessionVersion !== payload.sessionVersion) {
    throw new AppError("Sesión expirada, inicia sesión de nuevo", 401);
  }

  if (user.passwordChangedAt) {
    const issuedAtMs = ((payload as unknown as { iat?: number }).iat ?? 0) * 1000;
    if (user.passwordChangedAt.getTime() > issuedAtMs) {
      throw new AppError("Sesión expirada, inicia sesión de nuevo", 401);
    }
  }

  req.user = { id: user._id.toString(), role: user.role };
  next();
});

export { protect };
