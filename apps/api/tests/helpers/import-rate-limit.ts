import { vi } from "vitest";
import type * as RateLimitModule from "../../src/middlewares/rate-limit.js";

/** Secreto compartido de prueba: los tests lo mandan en `x-internal-token`. */
const TEST_INTERNAL_TOKEN = "i".repeat(40);

/**
 * `createRateLimiter` es no-op fuera de producción, así que probar un limiter
 * de verdad exige `NODE_ENV=production` real al evaluar `env.ts` (mismo truco
 * de `vi.resetModules` + import dinámico que `tests/config/env.test.ts`).
 */
async function importRateLimitInProduction(): Promise<typeof RateLimitModule> {
  vi.resetModules();
  const previous: Record<string, string | undefined> = {};
  const overrides: Record<string, string> = {
    NODE_ENV: "production",
    CLIENT_URL: "https://www.esenciaglow.com",
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    RESEND_API_KEY: "re_x",
    TRUST_PROXY_HOPS: "0",
    INTERNAL_API_TOKEN: TEST_INTERNAL_TOKEN,
    AUDIT_IP_HMAC_KEY: "a".repeat(40),
    CLOUDINARY_CLOUD_NAME: "cloud",
    CLOUDINARY_API_KEY: "key",
    CLOUDINARY_API_SECRET: "secret",
  };
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }
  try {
    return await import("../../src/middlewares/rate-limit.js");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.resetModules();
  }
}

export { importRateLimitInProduction, TEST_INTERNAL_TOKEN };
