/**
 * Acciones auditables del flujo de auth (audit-log.model.ts en apps/api).
 * Vive en shared para que el dashboard admin (Milestone 2) pueda mostrar el
 * audit trail con el mismo vocabulario que el backend, sin duplicarlo.
 */
enum AuthAction {
  REGISTER = "register",
  LOGIN = "login",
  LOGIN_2FA = "login_2fa",
  LOGOUT = "logout",
  LOGOUT_ALL = "logout_all",
  PASSWORD_RESET = "password_reset",
  PASSWORD_CHANGE = "password_change",
  EMAIL_VERIFIED = "email_verified",
  TWO_FACTOR_ENABLED = "two_factor_enabled",
  TWO_FACTOR_DISABLED = "two_factor_disabled",
  SESSION_REUSE_DETECTED = "session_reuse_detected",
}

export { AuthAction };
