import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { allowedOrigins, corsOptions } from "./config/cors.js";
import { env } from "./config/env.js";
import { httpLogger } from "./config/http-logger.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { globalRateLimiter } from "./middlewares/rate-limit.js";
import { mongoSanitize } from "./middlewares/mongo-sanitize.js";
import { notFound } from "./middlewares/not-found.js";
import { sanitizeInput } from "./middlewares/sanitize-input.js";
import { verifyOrigin } from "./middlewares/verify-origin.js";
import { paymentWebhookRoutes } from "./routes/payment-webhook.routes.js";
import { v1Router } from "./routes/index.js";

/**
 * Construye la app sin abrir puerto ni conectar la base de datos — necesario
 * para testear con supertest de forma aislada (ver tests/).
 *
 * Orden exacto de la cadena de middleware (BACKEND_SECURITY_GUIDELINES.md §13):
 * helmet -> log de requests -> webhook de Stripe (body crudo) -> cors ->
 * express.json -> cookieParser -> mongoSanitize -> sanitizeInput ->
 * verifyOrigin -> rateLimit -> routers -> notFound -> errorHandler
 *
 * El webhook de Stripe (Milestone 1.6.2) es la ÚNICA ruta que se monta
 * fuera de `v1Router` y antes de `cors`/`express.json`/`mongoSanitize`/
 * `sanitizeInput`/`verifyOrigin`/el limiter global: la verificación de
 * firma de Stripe necesita el Buffer crudo del body (no el JSON parseado
 * por `express.json`), y es una llamada server-to-server sin sesión de
 * usuario — su barrera es la firma, no CORS/CSRF/el rate limiter de
 * clientes reales (lleva el suyo propio, ver middlewares/rate-limit.ts).
 *
 * El log de requests (Milestone 1.10, `config/http-logger.ts`) va justo
 * después de helmet y ANTES del webhook, para que toda petición quede
 * registrada — incluida la de Stripe, la única que no pasa por el resto
 * de la cadena.
 */
function buildApp(): Express {
  const app = express();

  // Sin esto, req.ip toma la IP del último salto (el proxy, no el cliente),
  // colapsando todos los rate limiters con clave por IP en un solo bucket
  // compartido detrás de Railway/Cloudflare (TRUST_PROXY_HOPS, config/env.ts).
  app.set("trust proxy", env.trustProxyHops);

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(httpLogger);
  app.use("/api/v1/webhooks/stripe", paymentWebhookRoutes);
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());
  app.use(mongoSanitize);
  app.use(sanitizeInput);
  app.use(verifyOrigin(allowedOrigins));
  app.use(globalRateLimiter);

  app.use("/api/v1", v1Router);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export { buildApp };
