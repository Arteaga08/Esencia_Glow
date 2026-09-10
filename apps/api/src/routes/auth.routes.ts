import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as authController from "../controllers/auth.controller.js";
import * as twoFactorController from "../controllers/two-factor.controller.js";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { createRateLimiter, loginRateLimiter } from "../middlewares/rate-limit.js";
import {
  changePasswordSchema,
  emailOnlySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  twoFactorCodeSchema,
  twoFactorLoginSchema,
  verifyEmailSchema,
} from "../validators/auth.validator.js";

/**
 * Router de /api/v1/auth. Rate limiters por acción sensible
 * (BACKEND_SECURITY_GUIDELINES.md checklist) — `loginRateLimiter` ya existía
 * sin usar en middlewares/rate-limit.ts.
 */

const registerRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Demasiados registros, intenta de nuevo más tarde.",
});

const forgotPasswordRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Demasiadas solicitudes, intenta de nuevo más tarde.",
});

// Los tokens de verificación/reset ya son opacos de 32 bytes (infactibles de
// fuerza bruta), pero se limita igual por consistencia con el resto de
// acciones sensibles del router.
const tokenActionRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Demasiados intentos, intenta de nuevo más tarde.",
});

const router = Router();

router.post("/register", registerRateLimiter, validate(registerSchema), authController.register);
router.post("/login", loginRateLimiter, validate(loginSchema), authController.login);
router.post(
  "/login/2fa",
  loginRateLimiter,
  validate(twoFactorLoginSchema),
  authController.completeTwoFactorLogin,
);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.post("/logout-all", protect, authController.logoutAll);
router.get("/me", protect, authController.me);

router.post(
  "/verify-email",
  tokenActionRateLimiter,
  validate(verifyEmailSchema),
  authController.verifyEmail,
);
router.post(
  "/resend-verification",
  forgotPasswordRateLimiter,
  validate(emailOnlySchema),
  authController.resendVerification,
);
router.post(
  "/forgot-password",
  forgotPasswordRateLimiter,
  validate(emailOnlySchema),
  authController.forgotPassword,
);
router.post(
  "/reset-password",
  tokenActionRateLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);
router.patch(
  "/password",
  protect,
  validate(changePasswordSchema),
  authController.changePassword,
);

router.post("/2fa/setup", protect, restrictTo(UserRole.ADMIN), twoFactorController.setup);
router.post(
  "/2fa/enable",
  protect,
  restrictTo(UserRole.ADMIN),
  validate(twoFactorCodeSchema),
  twoFactorController.enable,
);
router.post(
  "/2fa/disable",
  protect,
  restrictTo(UserRole.ADMIN),
  validate(twoFactorCodeSchema),
  twoFactorController.disable,
);

export { router as authRoutes };
