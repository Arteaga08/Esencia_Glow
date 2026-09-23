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

/**
 * Resultado de `POST /auth/login`, como unión discriminada por `next` — no
 * dos booleanos opcionales (`twoFactorRequired?`, `twoFactorSetupRequired?`):
 * con dos flags separados existe un estado inválido representable (ninguno
 * presente por un bug del backend), que en el front terminaría navegando a
 * "/" sin sesión y en un loop con el guard de `(admin)/layout.tsx`. Con
 * `next` como único discriminante, un `switch` en el front es exhaustivo y
 * TypeScript obliga a cubrir cada caso.
 */
type LoginOutcome =
  | { next: "session"; user: PublicUser }
  | { next: "twoFactor" }
  | { next: "twoFactorSetup" };

/**
 * Respuesta de `POST /auth/login/2fa/setup` — el paso de enrolamiento
 * obligatorio de 2FA para un admin que todavía no lo tiene activo
 * (`BACKEND_SECURITY_GUIDELINES.md` §2). `manualEntryKey` es el mismo
 * secreto que ya viaja dentro de `otpauthUrl` y del QR — se expone también
 * como campo explícito para que el front no tenga que parsear la URL.
 */
interface TwoFactorEnrollment {
  otpauthUrl: string;
  qrCodeDataUrl: string;
  manualEntryKey: string;
}

export type { PublicUser, LoginOutcome, TwoFactorEnrollment };
