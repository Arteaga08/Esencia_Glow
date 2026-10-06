import { describe, expect, it } from "vitest";
import { renderTransactionalEmail } from "../../src/services/email-layout.js";

/**
 * `renderTransactionalEmail` — shell HTML compartido de todo correo
 * transaccional (§8 del plan de 1.6.3), siguiendo
 * ECOMMERCE_ARCHITECTURE_GUIDELINES.md §"Cómo se ve — correo": tablas (no
 * flex/grid), CSS inline (nunca `<style>`), botón "a prueba de balas" en
 * una `<td>`, preheader oculto, 16px de cuerpo y disclaimer siempre
 * presente.
 */
describe("services/email-layout — renderTransactionalEmail", () => {
  it("usa <table> para el layout, nunca flexbox/grid en línea", () => {
    const html = renderTransactionalEmail({
      preheader: "Confirma tu correo",
      title: "Confirma tu correo",
      paragraphs: ["Gracias por registrarte."],
      disclaimer: "Si tú no hiciste esto, ignora este mensaje.",
    });

    expect(html).toContain("<table");
    expect(html).not.toMatch(/display:\s*flex/);
    expect(html).not.toMatch(/display:\s*grid/);
  });

  it("nunca incluye un <style> — todo el CSS va inline", () => {
    const html = renderTransactionalEmail({
      preheader: "x",
      title: "x",
      paragraphs: ["x"],
      disclaimer: "x",
    });

    expect(html).not.toContain("<style");
  });

  it("incluye el preheader oculto de 1px antes que cualquier otro texto visible", () => {
    const html = renderTransactionalEmail({
      preheader: "Este es el preheader único",
      title: "Título",
      paragraphs: ["Cuerpo"],
      disclaimer: "Disclaimer",
    });

    const preheaderIndex = html.indexOf("Este es el preheader único");
    const bodyIndex = html.indexOf("Cuerpo");
    expect(preheaderIndex).toBeGreaterThanOrEqual(0);
    expect(preheaderIndex).toBeLessThan(bodyIndex);
    expect(html).toMatch(/font-size:\s*1px/);
  });

  it("siempre incluye el disclaimer", () => {
    const html = renderTransactionalEmail({
      preheader: "x",
      title: "x",
      paragraphs: ["x"],
      disclaimer: "Si tú no lo solicitaste, ignora este correo.",
    });

    expect(html).toContain("Si tú no lo solicitaste, ignora este correo.");
  });

  it("el botón (cuando se pasa) es una <td> con padding/background, no un <a> con esos estilos", () => {
    const html = renderTransactionalEmail({
      preheader: "x",
      title: "x",
      paragraphs: ["x"],
      disclaimer: "x",
      button: { label: "Ver mi ficha OXXO", url: "https://payments.stripe.com/oxxo/voucher/abc" },
    });

    expect(html).toContain("Ver mi ficha OXXO");
    expect(html).toContain('href="https://payments.stripe.com/oxxo/voucher/abc"');
    // El <a> del botón no debe cargar background-color/padding directo —
    // esos viven en la <td> que lo envuelve (Outlook/Word ignora
    // padding/border-radius en <a>, sí los respeta en <td>).
    const anchorMatch = html.match(/<a[^>]*href="https:\/\/payments\.stripe\.com\/oxxo\/voucher\/abc"[^>]*>/);
    expect(anchorMatch).not.toBeNull();
    expect(anchorMatch![0]).not.toMatch(/background-color/);
    expect(html).toMatch(/<td[^>]*background-color[^>]*>/);
  });

  it("sin botón, no renderiza ningún <a>", () => {
    const html = renderTransactionalEmail({ preheader: "x", title: "x", paragraphs: ["x"], disclaimer: "x" });
    expect(html).not.toContain("<a ");
  });

  it("el cuerpo usa 16px, no el 14px del sitio", () => {
    const html = renderTransactionalEmail({ preheader: "x", title: "x", paragraphs: ["Cuerpo del mensaje"], disclaimer: "x" });
    expect(html).toMatch(/font-size:\s*16px/);
  });

  it("los bloques de datos son texto plano: se escapan dentro del shell", () => {
    const html = renderTransactionalEmail({
      preheader: "x",
      title: "x",
      paragraphs: ["x"],
      disclaimer: "x",
      status: { label: "<b>Pago</b>", tone: "mint" },
      facts: [{ label: "Folio", value: "<i>EG-1</i>" }],
      order: { lines: [{ name: "<script>x</script>", detail: "150 ml", quantity: 2, totalCents: 78000 }] },
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<i>EG-1</i>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toMatch(/\$780\.00/);
    expect(html).not.toContain("<style");
  });

  it("el desglose de totales solo aparece cuando se pasan", () => {
    const withTotals = renderTransactionalEmail({
      preheader: "x",
      title: "x",
      paragraphs: ["x"],
      disclaimer: "x",
      order: {
        lines: [{ name: "Gel", quantity: 1, totalCents: 38900 }],
        totals: { subtotalCents: 38900, shippingCents: 9900, totalCents: 48800 },
      },
    });
    const without = renderTransactionalEmail({
      preheader: "x",
      title: "x",
      paragraphs: ["x"],
      disclaimer: "x",
      order: { lines: [{ name: "Gel", quantity: 1 }] },
    });

    expect(withTotals).toContain("Subtotal");
    expect(withTotals).toMatch(/\$488\.00/);
    expect(without).not.toContain("Subtotal");
  });

  it("el bloque de cupón y el de guía renderizan sus datos", () => {
    const html = renderTransactionalEmail({
      preheader: "x",
      title: "x",
      paragraphs: ["x"],
      disclaimer: "x",
      coupon: { code: "ANA15", discountLabel: "15% de descuento", message: "Gracias" },
      guide: { carrier: "Estafeta", trackingNumber: "EST1" },
    });

    expect(html).toContain("ANA15");
    expect(html).toContain("Estafeta");
    expect(html).toContain("EST1");
  });
});
