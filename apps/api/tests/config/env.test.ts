import { afterEach, describe, expect, it, vi } from "vitest";
import type * as EnvModule from "../../src/config/env.js";

/**
 * `env.ts` corre `buildEnv()` al importarse (fail-fast real, no un objeto
 * lazy) — para variar `process.env` entre casos hay que `resetModules` y
 * reimportar dinámicamente, mismo truco que ya usa `tests/setup.ts` para
 * `payment-provider.ts` (evita el hoisting de imports estáticos, que
 * evaluaría el módulo ANTES de tocar `process.env` en este archivo).
 */
async function importEnvWith(overrides: Record<string, string | undefined>): Promise<typeof EnvModule> {
  vi.resetModules();
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await import("../../src/config/env.js");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("config/env — tolerancia del webhook y umbral de reconciliación", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("STRIPE_WEBHOOK_TOLERANCE_SECONDS ausente -> default 300", async () => {
    const { env } = await importEnvWith({ STRIPE_WEBHOOK_TOLERANCE_SECONDS: undefined });
    expect(env.stripeWebhookToleranceSeconds).toBe(300);
  });

  it("STRIPE_WEBHOOK_TOLERANCE_SECONDS='0' -> lanza (nunca 0, anti-replay)", async () => {
    await expect(importEnvWith({ STRIPE_WEBHOOK_TOLERANCE_SECONDS: "0" })).rejects.toThrow();
  });

  it("STRIPE_WEBHOOK_TOLERANCE_SECONDS='abc' -> lanza", async () => {
    await expect(importEnvWith({ STRIPE_WEBHOOK_TOLERANCE_SECONDS: "abc" })).rejects.toThrow();
  });

  it("PAYMENT_RECONCILE_AFTER_MINUTES ausente -> default 10", async () => {
    const { env } = await importEnvWith({ PAYMENT_RECONCILE_AFTER_MINUTES: undefined });
    expect(env.paymentReconcileAfterMinutes).toBe(10);
  });

  it("PAYMENT_RECONCILE_AFTER_MINUTES='0' -> lanza", async () => {
    await expect(importEnvWith({ PAYMENT_RECONCILE_AFTER_MINUTES: "0" })).rejects.toThrow();
  });

  it("PAYMENT_RECONCILE_AFTER_MINUTES='-5' -> lanza", async () => {
    await expect(importEnvWith({ PAYMENT_RECONCILE_AFTER_MINUTES: "-5" })).rejects.toThrow();
  });

  it("SUBSCRIPTION_INCOMPLETE_EXPIRE_MINUTES ausente -> default 30", async () => {
    const { env } = await importEnvWith({ SUBSCRIPTION_INCOMPLETE_EXPIRE_MINUTES: undefined });
    expect(env.subscriptionIncompleteExpireMinutes).toBe(30);
  });

  it("SUBSCRIPTION_INCOMPLETE_EXPIRE_MINUTES='0' -> lanza", async () => {
    await expect(importEnvWith({ SUBSCRIPTION_INCOMPLETE_EXPIRE_MINUTES: "0" })).rejects.toThrow();
  });

  it("TRUST_PROXY_HOPS ausente -> default 0 (sin proxy de confianza)", async () => {
    const { env } = await importEnvWith({ TRUST_PROXY_HOPS: undefined });
    expect(env.trustProxyHops).toBe(0);
  });

  it("TRUST_PROXY_HOPS='2' -> 2 (Railway + Cloudflare, dos saltos)", async () => {
    const { env } = await importEnvWith({ TRUST_PROXY_HOPS: "2" });
    expect(env.trustProxyHops).toBe(2);
  });

  it("TRUST_PROXY_HOPS='-1' -> lanza (no puede ser negativo)", async () => {
    await expect(importEnvWith({ TRUST_PROXY_HOPS: "-1" })).rejects.toThrow();
  });

  it("TRUST_PROXY_HOPS='abc' -> lanza", async () => {
    await expect(importEnvWith({ TRUST_PROXY_HOPS: "abc" })).rejects.toThrow();
  });

  it("TRUST_PROXY_HOPS ausente en producción -> lanza (un default silencioso dejaría el fix inerte)", async () => {
    await expect(
      importEnvWith({
        NODE_ENV: "production",
        TRUST_PROXY_HOPS: undefined,
        CLIENT_URL: "https://www.esenciaglow.com",
        STRIPE_SECRET_KEY: "sk_test_x",
        STRIPE_WEBHOOK_SECRET: "whsec_x",
        RESEND_API_KEY: "re_x",
        CLOUDINARY_CLOUD_NAME: "cloud",
        CLOUDINARY_API_KEY: "key",
        CLOUDINARY_API_SECRET: "secret",
      }),
    ).rejects.toThrow();
  });

  it("TRUST_PROXY_HOPS presente en producción -> arranca con ese valor", async () => {
    const { env } = await importEnvWith({
      NODE_ENV: "production",
      TRUST_PROXY_HOPS: "2",
      CLIENT_URL: "https://www.esenciaglow.com",
      STRIPE_SECRET_KEY: "sk_test_x",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
      RESEND_API_KEY: "re_x",
      CLOUDINARY_CLOUD_NAME: "cloud",
      CLOUDINARY_API_KEY: "key",
      CLOUDINARY_API_SECRET: "secret",
    });
    expect(env.trustProxyHops).toBe(2);
  });
});

describe("config/env — REFRESH_TOKEN_TTL_DAYS", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("ausente -> default 30", async () => {
    const { env } = await importEnvWith({ REFRESH_TOKEN_TTL_DAYS: undefined });
    expect(env.refreshTokenTtlDays).toBe(30);
  });

  it("'abc' -> lanza (antes entraba como NaN sin quejarse)", async () => {
    await expect(importEnvWith({ REFRESH_TOKEN_TTL_DAYS: "abc" })).rejects.toThrow();
  });

  it("'0' -> lanza", async () => {
    await expect(importEnvWith({ REFRESH_TOKEN_TTL_DAYS: "0" })).rejects.toThrow();
  });

  it("'-5' -> lanza", async () => {
    await expect(importEnvWith({ REFRESH_TOKEN_TTL_DAYS: "-5" })).rejects.toThrow();
  });

  it("'45' -> 45", async () => {
    const { env } = await importEnvWith({ REFRESH_TOKEN_TTL_DAYS: "45" });
    expect(env.refreshTokenTtlDays).toBe(45);
  });
});
