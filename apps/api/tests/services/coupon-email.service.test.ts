import { beforeEach, describe, expect, it } from "vitest";
import { sendCouponEmail } from "../../src/services/coupon-email.service.js";
import { __setMailProviderForTests } from "../../src/services/mail-provider.js";
import { buildFakeMailProvider, type FakeMailProvider } from "../helpers/fake-mail-provider.js";

/**
 * `sendCouponEmail` (Milestone 3.6): plantilla lista, sin llamador hasta que
 * exista el módulo de cupones. `message` y `name` los escribe una persona,
 * así que llegan escapados al HTML.
 */
describe("services/coupon-email", () => {
  let fake: FakeMailProvider;

  beforeEach(() => {
    fake = buildFakeMailProvider();
    __setMailProviderForTests(fake);
  });

  it("incluye código, descuento y vigencia en el bloque de cupón", async () => {
    await sendCouponEmail({
      to: "ana@example.com",
      name: "Ana",
      code: "ANA15",
      discountLabel: "15% de descuento",
      expires: "Vigente hasta el 31 de octubre de 2026",
      shopUrl: "https://tienda.example/",
    });

    const call = fake.calls[0]!;
    expect(call.to).toBe("ana@example.com");
    expect(call.html).toContain("ANA15");
    expect(call.html).toContain("15% de descuento");
    expect(call.html).toContain("Vigente hasta el 31 de octubre de 2026");
    expect(call.html).toContain('href="https://tienda.example/"');
    expect(call.html).not.toContain("<style");
  });

  it("escapa el mensaje del admin y el nombre: no hay XSS almacenado", async () => {
    await sendCouponEmail({
      to: "ana@example.com",
      name: "<img src=x onerror=alert(1)>",
      code: "ANA15",
      discountLabel: "15% de descuento",
      message: "<script>alert(1)</script> gracias",
    });

    const html = fake.calls[0]!.html;
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });

  it("sin shopUrl el correo sale sin botón", async () => {
    await sendCouponEmail({ to: "ana@example.com", name: "Ana", code: "ANA15", discountLabel: "15% de descuento" });
    expect(fake.calls[0]!.html).not.toContain("<a ");
  });
});
