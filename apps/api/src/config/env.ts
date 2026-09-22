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

/**
 * Entero positivo con default sano — para variables donde `0` o negativo
 * sería un error silencioso disfrazado de configuración válida (Milestone
 * 1.6.2: tolerancia del webhook "nunca 0" y umbral de reconciliación).
 * `Number(process.env[key])` acepta `NaN`/`0` sin quejarse; esto no.
 */
function readPositiveInt(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim().length === 0) return defaultValue;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} debe ser un entero positivo (tiene "${raw}").`);
  }
  return parsed;
}

/**
 * Entero no-negativo con default sano — a diferencia de `readPositiveInt`,
 * aquí 0 es un valor legítimo (sin proxy de confianza delante, dev/test).
 * En producción, sin embargo, un default silencioso deja el fix inerte (el
 * operador olvida configurarlo y `trust proxy` queda en 0 de todas formas)
 * — ahí se exige explícitamente, igual que STRIPE_SECRET_KEY/RESEND_API_KEY.
 */
function readNonNegativeInt(key: string, defaultValue: number, nodeEnv: NodeEnv): number {
  requireInProduction(key, nodeEnv);
  const raw = process.env[key];
  if (raw === undefined || raw.trim().length === 0) return defaultValue;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${key} debe ser un entero no negativo (tiene "${raw}").`);
  }
  return parsed;
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

    // Pagos (Milestone 1.6): tolerancia de firma del webhook (nunca 0 — ver
    // stripe-webhook-translator.ts) y umbral del reconciliador de pagos
    // pendientes sin webhook, ambos con default sano en vez de número mágico.
    stripeWebhookToleranceSeconds: readPositiveInt("STRIPE_WEBHOOK_TOLERANCE_SECONDS", 300),
    paymentReconcileAfterMinutes: readPositiveInt("PAYMENT_RECONCILE_AFTER_MINUTES", 10),

    // Cantidad de saltos de reverse proxy de confianza delante de la API
    // (`app.set("trust proxy", N)`) — sin esto, TODO limiter con clave por IP
    // colapsa en un único bucket compartido detrás de Railway/Cloudflare, y
    // el webhook de Stripe pierde la IP real en sus logs. Default 0 (sin
    // proxy de confianza) fuera de producción; en Railway+Cloudflare se
    // configura con el número real de saltos.
    trustProxyHops: readNonNegativeInt("TRUST_PROXY_HOPS", 0, nodeEnv),

    // Suscripciones (Milestone 1.7.2a): minutos tras reclamar el cupo antes
    // de que el barrendero libere una cuenta `INCOMPLETE` que nunca completó
    // el alta con Stripe (§E del plan) — red de seguridad si la compensación
    // en línea del endpoint de alta falla.
    subscriptionIncompleteExpireMinutes: readPositiveInt("SUBSCRIPTION_INCOMPLETE_EXPIRE_MINUTES", 30),

    // Suscripciones (Milestone 1.7.2b): días de anticipación con los que el
    // job preventivo avisa al admin que falta la edición del ciclo que está
    // por cobrarse — el aviso llega ANTES del cobro, no después de que la
    // caja ya nació con `editionIncident`.
    subscriptionEditionAlertDays: readPositiveInt("SUBSCRIPTION_EDITION_ALERT_DAYS", 7),

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

    // Media del catálogo (Milestone 1.3): mismo criterio que Stripe/Resend —
    // requerida en producción, opcional en dev. Sin credenciales, las rutas
    // de imagen responden 503 "no configurado" en vez de fingir éxito (ver
    // services/media-provider.ts).
    cloudinaryCloudName: requireInProduction("CLOUDINARY_CLOUD_NAME", nodeEnv),
    cloudinaryApiKey: requireInProduction("CLOUDINARY_API_KEY", nodeEnv),
    cloudinaryApiSecret: requireInProduction("CLOUDINARY_API_SECRET", nodeEnv),
    // Carpeta raíz en Cloudinary. Con default por entorno para no sumar una
    // variable requerida solo por separar dev de producción.
    cloudinaryFolder: process.env.CLOUDINARY_FOLDER ?? `esencia-glow/${nodeEnv}`,
  });
}

const env = buildEnv();

export type Env = typeof env;
export { env };
