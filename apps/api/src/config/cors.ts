import type { CorsOptions } from "cors";
import { env } from "./env.js";

/**
 * Whitelist de orígenes, única fuente compartida por CORS y `verifyOrigin`
 * para que no se desincronicen. localhost solo fuera de producción.
 */
const allowedOrigins: readonly string[] = env.isProduction
  ? [env.clientUrl]
  : [env.clientUrl, "http://localhost:3000"];

const corsOptions: CorsOptions = {
  origin: allowedOrigins as string[],
  credentials: true,
};

export { allowedOrigins, corsOptions };
