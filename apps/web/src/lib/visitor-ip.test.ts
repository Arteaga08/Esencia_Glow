import { describe, expect, it } from "vitest";
import { parseTrustedHops, pickVisitorIp } from "./visitor-ip";

describe("pickVisitorIp — misma semántica que `trust proxy = N` de Express", () => {
  it("con un salto de confianza toma la última entrada (la que añadió ese proxy)", () => {
    expect(pickVisitorIp("198.51.100.7", 1)).toBe("198.51.100.7");
    // Lo que el cliente falsificó queda a la izquierda y se ignora.
    expect(pickVisitorIp("6.6.6.6, 198.51.100.7", 1)).toBe("198.51.100.7");
  });

  it("con dos saltos (Cloudflare + Railway) toma la penúltima", () => {
    expect(pickVisitorIp("6.6.6.6, 198.51.100.7, 172.16.0.5", 2)).toBe("198.51.100.7");
  });

  it("sin saltos de confianza no se fía de la cabecera", () => {
    expect(pickVisitorIp("198.51.100.7", 0)).toBeNull();
  });

  it("si la cadena es más corta que los saltos configurados -> null (algo no cuadra)", () => {
    expect(pickVisitorIp("198.51.100.7", 2)).toBeNull();
  });

  it("sin cabecera, vacía o con un valor que no es una IP -> null", () => {
    expect(pickVisitorIp(null, 1)).toBeNull();
    expect(pickVisitorIp("", 1)).toBeNull();
    expect(pickVisitorIp("no-soy-una-ip", 1)).toBeNull();
    expect(pickVisitorIp("198.51.100.7, <script>", 1)).toBeNull();
  });

  it("acepta IPv6 y recorta espacios", () => {
    expect(pickVisitorIp("  2001:db8::1 ", 1)).toBe("2001:db8::1");
  });
});

describe("parseTrustedHops", () => {
  it("entero no negativo -> el número", () => {
    expect(parseTrustedHops("0")).toBe(0);
    expect(parseTrustedHops("2")).toBe(2);
  });

  it("ausente, vacío, negativo o no numérico -> null", () => {
    expect(parseTrustedHops(undefined)).toBeNull();
    expect(parseTrustedHops("")).toBeNull();
    expect(parseTrustedHops("-1")).toBeNull();
    expect(parseTrustedHops("abc")).toBeNull();
    expect(parseTrustedHops("1.5")).toBeNull();
  });
});
