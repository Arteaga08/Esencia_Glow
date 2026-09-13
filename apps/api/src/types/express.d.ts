import type { UserCapabilities, UserRole } from "@esencia-glow/shared";

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
    /** Sellado por `requireIdempotencyKey` — un UUID v4 ya validado. */
    idempotencyKey?: string;
    /** Memoizado por `requireCapability` (Milestone 1.7.1): a lo más una
     * consulta a `resolveCapabilities` por request, nunca entre requests —
     * ver middlewares/require-capability.ts. */
    capabilities?: UserCapabilities;
  }
}

export {};
