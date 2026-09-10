import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { AppError } from "../utils/app-error.js";
import {
  ACCESS_COOKIE_NAME,
  PENDING_TWO_FACTOR_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  clearAuthCookies,
  setAccessCookie,
  setAuthCookies,
  setPendingTwoFactorCookie,
} from "../utils/cookies.js";
import { signAccessToken, verifyPendingTwoFactorToken } from "../utils/jwt.js";
import * as authService from "../services/auth.service.js";
import * as accountService from "../services/account.service.js";
import { rotateSession } from "../services/session.service.js";
import { User } from "../models/user.model.js";

/**
 * Controllers finos: parsean el request, llaman al service, arman la
 * respuesta. Cero lógica de negocio aquí — vive en services/.
 */

function sessionMeta(req: Request) {
  return { userAgent: req.headers["user-agent"] };
}

const register = asyncHandler(async (req: Request, res: Response) => {
  await authService.register(req.body);
  sendResponse(res, 201, "Si el correo es válido, te enviamos un enlace de verificación.", null);
});

const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body, sessionMeta(req));

  if (result.twoFactorRequired) {
    setPendingTwoFactorCookie(res, result.pendingToken);
    sendResponse(res, 200, "Ingresa tu código de verificación en dos pasos.", {
      twoFactorRequired: true,
    });
    return;
  }

  setAuthCookies(res, result.session);
  sendResponse(res, 200, "Sesión iniciada.", { user: result.user });
});

const completeTwoFactorLogin = asyncHandler(async (req: Request, res: Response) => {
  const pendingToken = req.cookies?.[PENDING_TWO_FACTOR_COOKIE_NAME] as string | undefined;
  if (!pendingToken) {
    throw new AppError("No hay un inicio de sesión pendiente de verificación", 401);
  }

  const { sub } = verifyPendingTwoFactorToken(pendingToken);
  const { session, user } = await authService.completeTwoFactorLogin(
    sub,
    req.body.code,
    sessionMeta(req),
  );

  res.clearCookie(PENDING_TWO_FACTOR_COOKIE_NAME, { path: "/api/v1/auth" });
  setAuthCookies(res, session);
  sendResponse(res, 200, "Sesión iniciada.", { user });
});

const refresh = asyncHandler(async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!rawRefreshToken) {
    throw new AppError("No autenticado", 401);
  }

  const rotated = await rotateSession(rawRefreshToken, sessionMeta(req));
  const user = await User.findById(rotated.userId);
  if (!user) {
    throw new AppError("No autenticado", 401);
  }

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    sessionVersion: user.sessionVersion,
  });

  setAuthCookies(res, { accessToken, refreshToken: rotated.rawToken });
  sendResponse(res, 200, "Sesión renovada.", null);
});

const logout = asyncHandler(async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  await authService.logout(rawRefreshToken);
  clearAuthCookies(res);
  sendResponse(res, 200, "Sesión cerrada.", null);
});

const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  await authService.logoutAll(req.user!.id);
  clearAuthCookies(res);
  sendResponse(res, 200, "Todas las sesiones fueron cerradas.", null);
});

const me = asyncHandler(async (req: Request, res: Response) => {
  sendResponse(res, 200, "OK", { user: req.user });
});

const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  await accountService.verifyEmail(req.body.token);
  sendResponse(res, 200, "Correo verificado. Ya puedes iniciar sesión.", null);
});

const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  await accountService.resendVerification(req.body.email);
  sendResponse(res, 200, "Si la cuenta existe y no está verificada, te enviamos un nuevo enlace.", null);
});

const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  await accountService.forgotPassword(req.body.email);
  sendResponse(res, 200, "Si el correo existe, te enviamos instrucciones para restablecer tu contraseña.", null);
});

const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await accountService.resetPassword(req.body.token, req.body.password);
  sendResponse(res, 200, "Contraseña actualizada. Inicia sesión con tu nueva contraseña.", null);
});

const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  const user = await accountService.changePassword(
    req.user!.id,
    req.body.currentPassword,
    req.body.newPassword,
    rawRefreshToken,
  );

  // El cambio de contraseña actualiza passwordChangedAt, lo que invalidaría
  // en protect el access token con el que llegó esta request — se reemite
  // aquí para que la sesión actual (ver "cierra las demás", no esta) siga
  // funcionando sin forzar un refresh o re-login inmediato.
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    sessionVersion: user.sessionVersion,
  });
  setAccessCookie(res, accessToken);

  sendResponse(res, 200, "Contraseña actualizada.", null);
});

export {
  register,
  login,
  completeTwoFactorLogin,
  refresh,
  logout,
  logoutAll,
  me,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
};
export { ACCESS_COOKIE_NAME };
