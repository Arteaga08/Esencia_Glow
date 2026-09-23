import rateLimit, { MemoryStore, type Options } from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { PENDING_TWO_FACTOR_COOKIE_NAME } from "../utils/cookies.js";
import { verifyPendingEnrollmentToken } from "../utils/jwt.js";

interface RateLimiterConfig {
  windowMs: number;
  max: number;
  message: string;
  /** Por defecto el limiter cuenta por IP. Un limiter que necesita contar
   * por identidad autenticada (`refundRateLimiter`) pasa esto — nunca al
   * revés, porque un endpoint público sin sesión no tiene con qué. */
  keyGenerator?: (req: Request) => string;
  /** Excluir rutas de la cuota (Milestone 1.10: el healthcheck de Railway,
   * que solo el limiter global necesita eximir). */
  skip?: (req: Request) => boolean;
}

/**
 * Factory de rate limiters por acción sensible. No-op fuera de producción
 * para no bloquear desarrollo ni tests. `MemoryStore` explícito por limiter
 * (no compartido) para poder resetear entre tests; migrar a Redis es el
 * disparador al escalar a más de una instancia.
 *
 * Rutas admin nunca pasan por aquí: su barrera es auth + rol, no throttling.
 */
function createRateLimiter(config: RateLimiterConfig) {
  if (!env.isProduction) {
    return (_req: Request, _res: Response, next: NextFunction): void => next();
  }

  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new MemoryStore(),
    message: { status: "fail", message: config.message },
    ...(config.keyGenerator ? { keyGenerator: config.keyGenerator } : {}),
    ...(config.skip ? { skip: config.skip } : {}),
  } satisfies Partial<Options>);
}

/**
 * Backstop global: cubre cualquier ruta que no tenga un limiter dedicado.
 * Exime `/health`/`/health/ready` (Milestone 1.10): sin esto, el healthcheck
 * de Railway compite por la misma cuota de 300/15min que los clientes
 * reales — un polling de Railway más frecuente que ~1 req/3s la agota,
 * Railway empieza a recibir 429 de su propio healthcheck, y la instancia
 * nunca se marca healthy (deploy que nunca pasa tráfico, o loop de restart).
 */
const globalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: "Demasiadas solicitudes, intenta de nuevo más tarde.",
  skip: (req) => req.path.startsWith("/api/v1/health"),
});

const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Demasiados intentos de inicio de sesión, intenta de nuevo más tarde.",
});

/**
 * `POST /login/2fa/setup` y `/login/2fa/enroll` (Milestone 2.1, enrolamiento
 * obligatorio de 2FA para admins). NO reusan `loginRateLimiter`: ese es
 * 5/15min por IP y ya lo consume `/login`, así que un enrolamiento legítimo
 * (login + setup + un código mal tecleado) agotaría la cuota entera y
 * dejaría al admin bloqueado 15 minutos tratando de activar 2FA por primera
 * vez. Cuenta por el `sub` del token de enrolamiento pendiente, no por IP
 * (mismo criterio que `refundRateLimiter`): dos admins detrás del mismo NAT
 * no deben compartir cuota, y sin sesión todavía no hay `req.user` del que
 * leerlo — se decodifica el token pendiente directo. Si el token falta o es
 * inválido cae a IP: ese request va a fallar igual más adelante en el
 * controller, pero el limiter necesita una key aunque sea así.
 */
const twoFactorEnrollmentRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Demasiados intentos, intenta de nuevo más tarde.",
  keyGenerator: (req) => {
    const token = req.cookies?.[PENDING_TWO_FACTOR_COOKIE_NAME] as string | undefined;
    if (!token) return req.ip ?? "unknown";
    try {
      return verifyPendingEnrollmentToken(token).sub;
    } catch {
      return req.ip ?? "unknown";
    }
  },
});

/**
 * Única excepción a "las rutas admin no llevan throttling": el costo de un
 * upload no es la consulta, es la CPU que `sharp` gasta decodificando y
 * reencodeando. Cubre las rutas de imagen del catálogo (Milestone 1.3).
 */
const uploadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Demasiadas subidas de imagen, intenta de nuevo más tarde.",
});

/** Endpoints públicos de catálogo: anti-scraping, no anti-abuso de sesión. */
const catalogRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: "Demasiadas solicitudes, intenta de nuevo más tarde.",
});

/**
 * `POST /orders`: crear una orden abre una transacción de 6 colecciones y
 * apalanca inventario real — más caro y más sensible a abuso que cotizar
 * (`quoteRateLimiter`, en `shipping.routes.ts`). El índice único de "un
 * pending por usuario" (§B del plan) ya topa el daño de un bot que
 * insista, pero el límite evita que ni siquiera llegue a chocar con él en
 * un burst.
 */
const checkoutRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Demasiados intentos de compra, intenta de nuevo más tarde.",
});

/**
 * `POST /orders/:id/payment`: reanudar el pago de un pedido ya creado. Más
 * permisivo que `checkoutRateLimiter` porque no reserva stock nuevo, pero
 * sigue acotado — es la misma superficie que crearía un PaymentIntent.
 */
const paymentResumeRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Demasiados intentos de pago, intenta de nuevo más tarde.",
});

/**
 * `POST /subscriptions` (Milestone 1.7.2a, Fase 4): igual que
 * `checkoutRateLimiter` — reclama cupo y crea Customer/Subscription en
 * Stripe, más caro y más sensible a abuso que una lectura. El índice único
 * `{userId}` de `SubscriptionAccount` ya topa el daño de un bot que
 * insista, pero el límite evita que ni siquiera llegue a chocar con él en
 * un burst.
 */
const subscribeRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Demasiados intentos de suscripción, intenta de nuevo más tarde.",
});

/**
 * `POST /webhooks/stripe`: server-to-server, sin sesión de usuario detrás —
 * su barrera es la firma, no el auth. Un burst de reentregas legítimas de
 * Stripe no debe agotar la cuota de los usuarios reales (por eso NO hereda
 * el limiter global), pero el endpoint tampoco puede quedar sin ningún
 * límite.
 */
const webhookRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 600,
  message: "Demasiadas solicitudes de webhook, intenta de nuevo más tarde.",
});

/**
 * `POST /admin/orders/:id/refund` (Milestone 1.6.3): SEGUNDA excepción a
 * "las rutas admin no llevan throttling" (la primera es `uploadRateLimiter`).
 * El step-up 2FA (decisión 9 del plan de 1.6) solo protege si alguien no
 * puede probar códigos TOTP de 6 dígitos sin límite — una sesión admin
 * robada tiene 1 en un millón por intento, pero sin este limiter tendría
 * intentos ilimitados para acercarse a esa probabilidad. Cuenta por
 * ADMIN (`req.user.id`), no por IP: dos admins detrás del mismo NAT de
 * oficina no deben compartir la cuota.
 */
const refundRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Demasiados intentos de reembolso, intenta de nuevo más tarde.",
  keyGenerator: (req) => req.user?.id ?? req.ip ?? "unknown",
});

/**
 * `POST /shipping/quotes` (Milestone 1.9): cada cotización es una llamada a un
 * tercero (Skydropx) dentro del checkout, con su propio costo y límite de
 * ~2 req/s por cuenta — un cliente descontrolado no debe agotar la cuota que
 * comparten todas las compradoras. Más holgado que `/orders` (cotizar es
 * barato y frecuente: se cotiza varias veces antes de decidir). Cuenta por
 * USUARIA, no por IP: dos clientas detrás del mismo NAT no comparten cuota.
 * Va DESPUÉS de `protect`, que es quien puebla `req.user`.
 */
const shippingQuoteRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: "Demasiadas cotizaciones de envío, intenta de nuevo más tarde.",
  keyGenerator: (req) => req.user?.id ?? req.ip ?? "unknown",
});

/**
 * Autoservicio de la suscriptora (Milestone 1.7.3): pausar, reanudar,
 * cancelar, deshacer y cambiar de plan. Cada llamada toca a Stripe, así que
 * un cliente descontrolado (o un bot con una sesión robada) no debe poder
 * martillarla. Cuenta por USUARIA, no por IP: dos clientas detrás del mismo
 * NAT no deben compartir la cuota.
 */
const subscriptionManageRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Demasiados cambios en tu suscripción, intenta de nuevo más tarde.",
  keyGenerator: (req) => req.user?.id ?? req.ip ?? "unknown",
});

/**
 * Cambio de tarjeta (1.7.3). Más estricto que el resto del autoservicio: con
 * una sesión robada, el flujo de SetupIntent + reintento de factura es un
 * canal de card-testing (probar tarjetas robadas contra una factura real).
 */
const paymentMethodRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Demasiados intentos de cambiar tu tarjeta, intenta de nuevo más tarde.",
  keyGenerator: (req) => req.user?.id ?? req.ip ?? "unknown",
});

export {
  createRateLimiter,
  globalRateLimiter,
  loginRateLimiter,
  twoFactorEnrollmentRateLimiter,
  uploadRateLimiter,
  catalogRateLimiter,
  checkoutRateLimiter,
  paymentResumeRateLimiter,
  subscribeRateLimiter,
  webhookRateLimiter,
  refundRateLimiter,
  shippingQuoteRateLimiter,
  subscriptionManageRateLimiter,
  paymentMethodRateLimiter,
};
