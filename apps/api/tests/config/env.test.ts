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
});
