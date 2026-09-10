import "dotenv/config";

/**
 * Carga y valida las variables de entorno al arrancar el proceso (fail-fast).
 * El objeto `env` queda congelado e importable en cualquier módulo — nunca se
 * lee `process.env` fuera de este archivo.
 *
 * Criterio de qué es requerido en qué entorno: ver
 * ~/.claude/standards/BACKEND_ARCHITECTURE_GUIDELINES.md §4
 * ("Fail-fast vs. fail-soft según criticidad") y el README raíz del proyecto.
 */

type NodeEnv = "development" | "production" | "test";

const MIN_SECRET_LENGTH = 32;

function readNodeEnv(): NodeEnv {
  const raw = process.env.NODE_ENV;
  if (raw === "production" || raw === "development" || raw === "test") {
    return raw;
  }
  throw new Error(
    `NODE_ENV inválido o ausente: "${raw}". Debe ser production, development o test.`,
  );
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Falta la variable de entorno requerida: ${key}`);
  }
  return value;
}

function requireSecret(key: string, minLength = MIN_SECRET_LENGTH): string {
  const value = requireEnv(key);
  if (value.length < minLength) {
    throw new Error(`${key} debe tener al menos ${minLength} caracteres (tiene ${value.length}).`);
  }
  return value;
}

function requireInProduction(key: string, nodeEnv: NodeEnv): string | undefined {
  const value = process.env[key];
  if (nodeEnv === "production" && (!value || value.trim().length === 0)) {
    throw new Error(`Falta la variable de entorno requerida en producción: ${key}`);
  }
  return value;
}

function buildEnv() {
  const nodeEnv = readNodeEnv();

  const port = Number(process.env.PORT ?? 4000);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`PORT inválido: "${process.env.PORT}".`);
  }

  return Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === "production",
    isDevelopment: nodeEnv === "development",
    isTest: nodeEnv === "test",
    port,

    // Core: siempre requeridas, en todo entorno. Sin estas el server no puede
    // operar de forma segura (auth, cifrado, DB con nombre explícito).
    jwtSecret: requireSecret("JWT_SECRET", 48),
    jwtRefreshSecret: requireSecret("JWT_REFRESH_SECRET", 48),
    encryptionKey: requireSecret("ENCRYPTION_KEY", 32),
    mongodbUri: requireEnv("MONGODB_URI"),

    // Requeridas solo en producción; en dev/test el server arranca sin ellas
    // pero cualquier ruta que las necesite responde 503 "no configurado".
    clientUrl: requireInProduction("CLIENT_URL", nodeEnv) ?? "http://localhost:3000",

    // Integraciones de las que depende un flujo de negocio central (pagos,
    // correo transaccional del flujo de auth): requeridas en producción,
    // opcionales en dev — su ausencia en dev responde 503, nunca finge éxito.
    stripeSecretKey: requireInProduction("STRIPE_SECRET_KEY", nodeEnv),
    stripeWebhookSecret: requireInProduction("STRIPE_WEBHOOK_SECRET", nodeEnv),
    resendApiKey: requireInProduction("RESEND_API_KEY", nodeEnv),
    // Remitente de correo transaccional. En dev, sin dominio verificado en
    // Resend, se usa el remitente sandbox que Resend permite sin configurar.
    resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",

    // Vida de los tokens de sesión. El access token es corto porque no es
    // revocable (es JWT); el refresh es largo pero vive hasheado en DB y
    // es revocable de verdad (ver models/session.model.ts).
    accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
    refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30),

    // Integraciones puramente operativas/de notificación: opcionales siempre,
    // incluso en producción. Su ausencia se degrada a loguear, nunca a bloquear.
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    adminAlertEmail: process.env.ADMIN_ALERT_EMAIL,
    sentryDsn: process.env.SENTRY_DSN,

    // Solo leídas por src/scripts/seed-admin.ts, nunca por el server. Ausentes
    // en producción salvo que se ejecute el seed explícitamente ahí.
    seedAdminEmail: process.env.SEED_ADMIN_EMAIL,
    seedAdminPassword: process.env.SEED_ADMIN_PASSWORD,
    seedAdminRole: process.env.SEED_ADMIN_ROLE,

    // Placeholders documentados para el milestone 1.3 (uploadService); no se
    // leen todavía en este milestone.
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
  });
}

const env = buildEnv();

export type Env = typeof env;
export { env };
