import bcrypt from "bcrypt";
import type { Types } from "mongoose";
import { AuthAction, UserRole, type PublicUser } from "@esencia-glow/shared";
import { User, SALT_ROUNDS } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import { signAccessToken, signPendingTwoFactorToken } from "../utils/jwt.js";
import { issueSession, revokeAllForUser, revokeSession, type SessionMeta } from "./session.service.js";
import { sendVerificationEmail } from "./email.service.js";
import { issueVerificationTokenForRegistration } from "./account.service.js";
import { verifyTwoFactorCode } from "./two-factor.service.js";
import { recordAudit } from "./audit.service.js";

/**
 * Registro, login (incluyendo el paso 2 de 2FA) y logout. Toda la lógica de
 * negocio vive aquí — controllers/auth.controller.ts solo traduce HTTP.
 *
 * Mensaje de error genérico en login (`"Email o contraseña incorrectos"`)
 * tanto si el email no existe como si la contraseña falla — anti user
 * enumeration (BACKEND_SECURITY_GUIDELINES.md §1). El 403 de correo sin
 * verificar solo se decide DESPUÉS de validar la contraseña.
 */

const GENERIC_LOGIN_ERROR = "Email o contraseña incorrectos";
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("dummy-timing-oracle-guard", SALT_ROUNDS);

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthenticatedSession {
  accessToken: string;
  refreshToken: string;
}

type LoginResult =
  | { twoFactorRequired: false; session: AuthenticatedSession; user: PublicUser }
  | { twoFactorRequired: true; pendingToken: string };

/** Único lugar que decide qué campos de User cruzan al cliente. */
function buildPublicUser(user: {
  _id: Types.ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  emailVerified: boolean;
}): PublicUser {
  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    emailVerified: user.emailVerified,
  };
}

/**
 * Siempre responde con éxito genérico — nunca revela si el email ya existía
 * (register hace su propio trabajo equivalente vía el `pre("save")` de
 * hashing, que corre igual se cree o no el usuario, porque solo se hashea
 * cuando el usuario sí se crea; la rama "ya existe" hace el mismo trabajo de
 * CPU explícitamente para no filtrar tiempo de respuesta).
 */
async function register(input: RegisterInput): Promise<void> {
  const existing = await User.findOne({ email: input.email }).select("_id");
  if (existing) {
    await bcrypt.compare("dummy-timing-oracle-guard", DUMMY_PASSWORD_HASH);
    return;
  }

  const user = await User.create({
    email: input.email,
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
    role: UserRole.CUSTOMER,
  });

  const rawToken = await issueVerificationTokenForRegistration(user._id);
  await sendVerificationEmail(user.email, rawToken);
  await recordAudit({ action: AuthAction.REGISTER, actorId: user._id, targetId: user._id });
}

async function issueAuthenticatedSession(
  user: { _id: Types.ObjectId; role: UserRole; sessionVersion: number },
  meta: SessionMeta,
): Promise<AuthenticatedSession> {
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    sessionVersion: user.sessionVersion,
  });
  const { rawToken: refreshToken } = await issueSession(user._id, meta);
  return { accessToken, refreshToken };
}

async function login(input: LoginInput, meta: SessionMeta): Promise<LoginResult> {
  const user = await User.findOne({ email: input.email }).select("+password");

  if (!user) {
    await bcrypt.compare(input.password, DUMMY_PASSWORD_HASH);
    throw new AppError(GENERIC_LOGIN_ERROR, 401);
  }

  const isValidPassword = await user.comparePassword(input.password);
  if (!isValidPassword) {
    throw new AppError(GENERIC_LOGIN_ERROR, 401);
  }

  // El 403 de verificación solo llega tras validar la contraseña — antes de
  // eso sería un oráculo de enumeración de cuentas.
  if (!user.emailVerified) {
    throw new AppError("Verifica tu correo antes de iniciar sesión", 403);
  }

  if (user.twoFactor.enabled) {
    const pendingToken = signPendingTwoFactorToken({ sub: user._id.toString() });
    return { twoFactorRequired: true, pendingToken };
  }

  const session = await issueAuthenticatedSession(user, meta);
  await recordAudit({ action: AuthAction.LOGIN, actorId: user._id, targetId: user._id });
  return { twoFactorRequired: false, session, user: buildPublicUser(user) };
}

async function completeTwoFactorLogin(
  userId: string,
  code: string,
  meta: SessionMeta,
): Promise<{ session: AuthenticatedSession; user: ReturnType<typeof buildPublicUser> }> {
  const user = await User.findById(userId);
  if (!user) throw new AppError("Sesión inválida, inicia sesión de nuevo", 401);

  await verifyTwoFactorCode(user._id, code);

  const session = await issueAuthenticatedSession(user, meta);
  await recordAudit({ action: AuthAction.LOGIN_2FA, actorId: user._id, targetId: user._id });
  return { session, user: buildPublicUser(user) };
}

async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) return;
  await revokeSession(rawRefreshToken);
}

async function logoutAll(userId: Types.ObjectId | string): Promise<void> {
  await revokeAllForUser(userId);
  await recordAudit({ action: AuthAction.LOGOUT_ALL, actorId: userId, targetId: userId });
}

export {
  register,
  login,
  completeTwoFactorLogin,
  logout,
  logoutAll,
  buildPublicUser,
  GENERIC_LOGIN_ERROR,
};
export type { RegisterInput, LoginInput, LoginResult, AuthenticatedSession };
