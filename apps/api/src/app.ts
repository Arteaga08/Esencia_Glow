import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { allowedOrigins, corsOptions } from "./config/cors.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { globalRateLimiter } from "./middlewares/rate-limit.js";
import { mongoSanitize } from "./middlewares/mongo-sanitize.js";
import { notFound } from "./middlewares/not-found.js";
import { sanitizeInput } from "./middlewares/sanitize-input.js";
import { verifyOrigin } from "./middlewares/verify-origin.js";
import { v1Router } from "./routes/index.js";

/**
 * Construye la app sin abrir puerto ni conectar la base de datos — necesario
 * para testear con supertest de forma aislada (ver tests/).
 *
 * Orden exacto de la cadena de middleware (BACKEND_SECURITY_GUIDELINES.md §13):
 * helmet -> cors -> express.json -> cookieParser -> mongoSanitize ->
 * sanitizeInput -> verifyOrigin -> rateLimit -> routers -> notFound -> errorHandler
 *
 * Nota: los webhooks de proveedores externos (pagos, envíos) se montan con
 * body crudo ANTES de express.json cuando se agreguen — no existen todavía
 * en este milestone.
 */
function buildApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
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
