import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { clientIpKey, hasValidInternalToken, isTrustedServerRequest, resolveClientIp } from "../../src/utils/client-ip.js";

const TOKEN = "i".repeat(40);

/** Request mínimo: solo lo que leen los helpers (headers en minúsculas, como Express). */
function fakeRequest(headers: Record<string, string>, ip = "203.0.113.9"): Request {
  return { headers, ip } as unknown as Request;
}

describe("utils/client-ip — hasValidInternalToken", () => {
  it("token correcto -> true", () => {
    expect(hasValidInternalToken(fakeRequest({ "x-internal-token": TOKEN }), TOKEN)).toBe(true);
  });

  it("token incorrecto, de otra longitud o ausente -> false", () => {
    expect(hasValidInternalToken(fakeRequest({ "x-internal-token": "x".repeat(40) }), TOKEN)).toBe(false);
    expect(hasValidInternalToken(fakeRequest({ "x-internal-token": "corto" }), TOKEN)).toBe(false);
    expect(hasValidInternalToken(fakeRequest({}), TOKEN)).toBe(false);
  });

  it("sin token configurado en el servidor -> false aunque el header venga vacío", () => {
    expect(hasValidInternalToken(fakeRequest({ "x-internal-token": "" }), undefined)).toBe(false);
    expect(hasValidInternalToken(fakeRequest({ "x-internal-token": TOKEN }), undefined)).toBe(false);
  });
});

describe("utils/client-ip — resolveClientIp", () => {
  it("con token válido y x-client-ip válida -> la IP reenviada", () => {
    const req = fakeRequest({ "x-internal-token": TOKEN, "x-client-ip": "198.51.100.7" });
    expect(resolveClientIp(req, TOKEN)).toBe("198.51.100.7");
  });

  it("sin token (header falsificado por un cliente cualquiera) -> req.ip", () => {
    const req = fakeRequest({ "x-client-ip": "198.51.100.7" });
    expect(resolveClientIp(req, TOKEN)).toBe("203.0.113.9");
  });

  it("con token pero x-client-ip que no es una IP -> req.ip", () => {
    const req = fakeRequest({ "x-internal-token": TOKEN, "x-client-ip": "no-soy-una-ip" });
    expect(resolveClientIp(req, TOKEN)).toBe("203.0.113.9");
  });
});

describe("utils/client-ip — clientIpKey", () => {
  it("IPv4 queda intacta", () => {
    expect(clientIpKey(fakeRequest({}, "203.0.113.9"), undefined)).toBe("203.0.113.9");
  });

  it("dos direcciones IPv6 del mismo /56 comparten llave", () => {
    const a = clientIpKey(fakeRequest({}, "2001:db8:abcd:12::1"), undefined);
    const b = clientIpKey(fakeRequest({}, "2001:db8:abcd:12:ffff:ffff:ffff:ffff"), undefined);
    const c = clientIpKey(fakeRequest({}, "2001:db8:abcd:ff::1"), undefined);
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it("IPv6 de /56 distintos -> llaves distintas", () => {
    expect(clientIpKey(fakeRequest({}, "2001:db8:abcd:1200::1"), undefined)).not.toBe(
      clientIpKey(fakeRequest({}, "2001:db8:abce:1200::1"), undefined),
    );
  });

  it("usa la IP reenviada (agrupada) cuando el token es válido", () => {
    const req = fakeRequest({ "x-internal-token": TOKEN, "x-client-ip": "2001:db8:abcd:12::5" });
    expect(clientIpKey(req, TOKEN)).toBe(clientIpKey(fakeRequest({}, "2001:db8:abcd:12::99"), undefined));
  });
});

describe("utils/client-ip — isTrustedServerRequest", () => {
  it("token válido SIN x-client-ip (fetch cacheado del SSR) -> true", () => {
    expect(isTrustedServerRequest(fakeRequest({ "x-internal-token": TOKEN }), TOKEN)).toBe(true);
  });

  it("token válido CON x-client-ip (hay un visitante detrás) -> false: se cuenta por su IP", () => {
    const req = fakeRequest({ "x-internal-token": TOKEN, "x-client-ip": "198.51.100.7" });
    expect(isTrustedServerRequest(req, TOKEN)).toBe(false);
  });

  it("sin token válido -> false", () => {
    expect(isTrustedServerRequest(fakeRequest({}), TOKEN)).toBe(false);
  });
});
