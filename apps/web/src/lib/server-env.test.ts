import { describe, expect, it } from "vitest";
import { findServerEnvProblems } from "./server-env";

const GOOD = { NODE_ENV: "production", INTERNAL_API_TOKEN: "t".repeat(40), TRUST_PROXY_HOPS: "2" };

describe("findServerEnvProblems — variables de servidor del web", () => {
  it("producción bien configurada -> sin problemas", () => {
    expect(findServerEnvProblems(GOOD)).toEqual([]);
  });

  it("fuera de producción no exige nada", () => {
    expect(findServerEnvProblems({ NODE_ENV: "development" })).toEqual([]);
    expect(findServerEnvProblems({ NODE_ENV: "test" })).toEqual([]);
  });

  it("producción sin INTERNAL_API_TOKEN o con uno corto -> problema", () => {
    expect(findServerEnvProblems({ ...GOOD, INTERNAL_API_TOKEN: undefined })).toHaveLength(1);
    expect(findServerEnvProblems({ ...GOOD, INTERNAL_API_TOKEN: "corto" })).toHaveLength(1);
  });

  it("producción sin TRUST_PROXY_HOPS válido -> problema (un default silencioso dejaría el arreglo inerte)", () => {
    expect(findServerEnvProblems({ ...GOOD, TRUST_PROXY_HOPS: undefined })).toHaveLength(1);
    expect(findServerEnvProblems({ ...GOOD, TRUST_PROXY_HOPS: "-1" })).toHaveLength(1);
    expect(findServerEnvProblems({ ...GOOD, TRUST_PROXY_HOPS: "abc" })).toHaveLength(1);
    // 0 saltos = no se puede conocer la IP del visitante: en producción no sirve.
    expect(findServerEnvProblems({ ...GOOD, TRUST_PROXY_HOPS: "0" })).toHaveLength(1);
  });

  it("acumula todos los problemas en vez de parar en el primero", () => {
    expect(findServerEnvProblems({ NODE_ENV: "production" })).toHaveLength(2);
  });
});
