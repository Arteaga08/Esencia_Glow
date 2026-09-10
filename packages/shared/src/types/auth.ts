import type { UserRole } from "../enums/user-role.js";

/**
 * DTO público de usuario — nunca incluye password ni el secreto 2FA. El API
 * lo arma con `buildPublicUser` (auth.service.ts) para que sea el único
 * lugar que decide qué campos de User cruzan al cliente; el dashboard (M2)
 * consume este mismo contrato.
 */
interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  emailVerified: boolean;
}

/** Respuesta de login cuando no requiere segundo factor. */
interface LoginResult {
  user: PublicUser;
}

export type { PublicUser, LoginResult };
