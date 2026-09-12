import { describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/utils/escape-html.js";

/**
 * `escapeHtml` — todo texto interpolado en un correo pasa por aquí (§8 del
 * plan de 1.6.3), incluido `shippingAddress.fullName` que escribe la
 * clienta: sin esto, un nombre con `<script>` sería un XSS almacenado
 * apuntando a la propia bandeja de la clienta.
 */
describe("utils/escape-html", () => {
  it("escapa &, <, >, comillas dobles y simples", () => {
    expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });

  it("no toca texto sin caracteres especiales", () => {
    expect(escapeHtml("Ana Pérez")).toBe("Ana Pérez");
  });

  it("neutraliza una etiqueta script completa", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
  });

  it("escapa múltiples ocurrencias, no solo la primera", () => {
    expect(escapeHtml("<<>>")).toBe("&lt;&lt;&gt;&gt;");
  });
});
