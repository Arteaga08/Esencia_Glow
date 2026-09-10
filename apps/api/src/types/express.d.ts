import type { UserRole } from "@esencia-glow/shared";

/**
 * Extiende `Request` con el usuario autenticado que `protect` adjunta tras
 * verificar el access token. Tipado explícito — nunca `any` en req.user.
 */
declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      role: UserRole;
    };
  }
}

export {};
