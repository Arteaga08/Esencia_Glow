import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";

/**
 * `TRUST_PROXY_HOPS` ya está probado a fondo (parseo, defaults, errores) en
 * `tests/config/env.test.ts`; aquí solo se confirma que `buildApp()` aplica
 * ese valor a Express (`app.set("trust proxy", ...)`), sin reimportar el
 * módulo completo — hacerlo recompilaría los modelos de Mongoose ya
 * registrados por el resto de la suite.
 */
describe("app — trust proxy", () => {
  it("app.set('trust proxy', ...) usa env.trustProxyHops", () => {
    const app = buildApp();
    expect(app.get("trust proxy")).toBe(env.trustProxyHops);
  });
});
