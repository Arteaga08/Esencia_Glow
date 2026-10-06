import { describe, expect, it } from "vitest";
import { DEFAULT_REDIRECT, resolveRedirect } from "./safe-redirect";

describe("resolveRedirect", () => {
  it("deja pasar rutas del mismo sitio, con query y hash", () => {
    expect(resolveRedirect("/mi-cuenta/pedidos")).toBe("/mi-cuenta/pedidos");
    expect(resolveRedirect("/producto/serum-vitamina-c?variante=2")).toBe("/producto/serum-vitamina-c?variante=2");
    expect(resolveRedirect("/categoria/rostro#filtros")).toBe("/categoria/rostro#filtros");
  });

  it("cae al destino por defecto sin valor, vacío o con un arreglo", () => {
    expect(resolveRedirect(undefined)).toBe(DEFAULT_REDIRECT);
    expect(resolveRedirect(null)).toBe(DEFAULT_REDIRECT);
    expect(resolveRedirect("")).toBe(DEFAULT_REDIRECT);
    expect(resolveRedirect(["/mi-cuenta", "/otra"])).toBe(DEFAULT_REDIRECT);
  });

  it.each([
    "https://evil.com",
    "http://evil.com/mi-cuenta",
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r/evil.com",
    "\t//evil.com",
    " //evil.com",
    "javascript:alert(1)",
    "data:text/html,<script>1</script>",
    "mailto:a@b.com",
    "evil.com",
    "mi-cuenta",
    "/mi-cuenta/../../..//evil.com",
  ])("rechaza %j", (value) => {
    const result = resolveRedirect(value);
    expect(result.startsWith("//")).toBe(false);
    expect(result).not.toMatch(/evil/);
    expect(result.startsWith("/")).toBe(true);
  });

  it("no manda a quien ya entró al panel ni de vuelta a las pantallas de acceso", () => {
    for (const value of ["/admin", "/admin/orders", "/admin/../admin", "/ingresar", "/crear-cuenta", "/verificar-correo?token=x", "/recuperar-contrasena", "/restablecer-contrasena?token=x"]) {
      expect(resolveRedirect(value)).toBe(DEFAULT_REDIRECT);
    }
  });

  it("no confunde rutas que solo empiezan parecido", () => {
    expect(resolveRedirect("/administradora")).toBe("/administradora");
  });

  it("rechaza valores absurdamente largos", () => {
    expect(resolveRedirect(`/${"a".repeat(600)}`)).toBe(DEFAULT_REDIRECT);
  });
});
