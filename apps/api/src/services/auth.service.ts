import bcrypt from "bcrypt";
import type { Types } from "mongoose";
import { AuthAction, UserRole, type PublicUser, type TwoFactorEnrollment } from "@esencia-glow/shared";
import { User, SALT_ROUNDS, type UserDocument } from "../models/user.model.js";
import { AppError } from "../utils/app-error.js";
import { signAccessToken, signPendingEnrollmentToken, signPendingTwoFactorToken } from "../utils/jwt.js";
import { issueSession, revokeAllForUser, revokeSession, type SessionMeta } from "./session.service.js";
import { sendVerificationEmail } from "./email.service.js";
import { issueVerificationTokenForRegistration } from "./account.service.js";
import { enableTwoFactor, ensureEnrollmentSecret, verifyTwoFactorCode } from "./two-factor.service.js";
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

/**
 * Igual criterio que `LoginOutcome` de shared (ver su comentario): unión por
 * `outcome`, no boolean(es) opcionales — un estado inválido representable acá
 * (p. ej. ninguna rama con `pendingToken` ni `session`) se propagaría directo
 * al controller.
 */
type LoginResult =
  | { outcome: "session"; session: AuthenticatedSession; user: PublicUser }
  | { outcome: "twoFactorRequired"; pendingToken: string }
  | { outcome: "twoFactorSetupRequired"; pendingToken: string };

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
    const pendingToken = signPendingTwoFactorToken({
      sub: user._id.toString(),
      sessionVersion: user.sessionVersion,
    });
    return { outcome: "twoFactorRequired", pendingToken };
  }

  // Un admin sin 2FA nunca recibe sesión: BACKEND_SECURITY_GUIDELINES.md §2
  // exige 2FA para cuentas admin pero nunca dijo CUÁNDO se enrola, y hasta
  // ahora el enrolamiento era un endpoint autenticado sin ninguna UI que lo
  // llamara — la cuenta más privilegiada del sistema podía operar
  // indefinidamente con un solo factor. El `pendingToken` de este camino usa
  // `signPendingEnrollmentToken` (purpose `pending_2fa_setup`), NUNCA
  // `signPendingTwoFactorToken`: ver el comentario de jwt.ts sobre por qué
  // compartir purpose entre login-2FA y enrolamiento sería un bypass total
  // de 2FA para cualquier cuenta que ya lo tenga activo.
  if (user.role === UserRole.ADMIN) {
    const pendingToken = signPendingEnrollmentToken({
      sub: user._id.toString(),
      sessionVersion: user.sessionVersion,
    });
    return { outcome: "twoFactorSetupRequired", pendingToken };
  }

  const session = await issueAuthenticatedSession(user, meta);
  await recordAudit({ action: AuthAction.LOGIN, actorId: user._id, targetId: user._id });
  return { outcome: "session", session, user: buildPublicUser(user) };
}

async function completeTwoFactorLogin(
  userId: string,
  sessionVersion: number,
  code: string,
  meta: SessionMeta,
): Promise<{ session: AuthenticatedSession; user: ReturnType<typeof buildPublicUser> }> {
  const user = await User.findById(userId);
  if (!user) throw new AppError("Sesión inválida, inicia sesión de nuevo", 401);
  if (user.sessionVersion !== sessionVersion) {
    throw new AppError("Sesión inválida, inicia sesión de nuevo", 401);
  }

  await verifyTwoFactorCode(user._id, code);

  const session = await issueAuthenticatedSession(user, meta);
  await recordAudit({ action: AuthAction.LOGIN_2FA, actorId: user._id, targetId: user._id });
  return { session, user: buildPublicUser(user) };
}

/**
 * Re-verifica rol, `sessionVersion` y estado de 2FA contra la BD (no solo el
 * pending token) en ambas funciones de enrolamiento: el token vive hasta 5
 * minutos, ventana en la que el rol pudo cambiar, la sesión pudo revocarse en
 * masa, o alguien más pudo activar 2FA en la cuenta.
 */
async function assertPendingEnrollment(userId: string, sessionVersion: number): Promise<UserDocument> {
  const user = await User.findById(userId);
  if (!user) throw new AppError("Sesión inválida, inicia sesión de nuevo", 401);
  if (user.sessionVersion !== sessionVersion) {
    throw new AppError("Sesión inválida, inicia sesión de nuevo", 401);
  }
  if (user.role !== UserRole.ADMIN) {
    throw new AppError("Sesión inválida, inicia sesión de nuevo", 401);
  }
  if (user.twoFactor.enabled) {
    throw new AppError("Esta cuenta ya tiene 2FA activo, inicia sesión de nuevo", 409);
  }
  return user;
}

async function beginTwoFactorEnrollment(
  userId: string,
  sessionVersion: number,
): Promise<TwoFactorEnrollment> {
  const user = await assertPendingEnrollment(userId, sessionVersion);
  const result = await ensureEnrollmentSecret(user._id);
  return {
    otpauthUrl: result.otpauthUrl,
    qrCodeDataUrl: result.qrCodeDataUrl,
    manualEntryKey: result.secret,
  };
}

async function completeTwoFactorEnrollment(
  userId: string,
  sessionVersion: number,
  code: string,
  meta: SessionMeta,
): Promise<{ session: AuthenticatedSession; user: ReturnType<typeof buildPublicUser> }> {
  const user = await assertPendingEnrollment(userId, sessionVersion);
  if (!user.emailVerified) {
    throw new AppError("Verifica tu correo antes de iniciar sesión", 403);
  }

  await enableTwoFactor(user._id, code);

  const session = await issueAuthenticatedSession(user, meta);
  // Se audita LOGIN además del TWO_FACTOR_ENABLED que ya deja `enableTwoFactor`:
  // este canje también emite sesión, y sin este registro habría inicios de
  // sesión de admin sin traza en el audit trail.
  await recordAudit({ action: AuthAction.LOGIN, actorId: user._id, targetId: user._id });
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
  beginTwoFactorEnrollment,
  completeTwoFactorEnrollment,
  logout,
  logoutAll,
  buildPublicUser,
  GENERIC_LOGIN_ERROR,
};
export type { RegisterInput, LoginInput, LoginResult, AuthenticatedSession };
