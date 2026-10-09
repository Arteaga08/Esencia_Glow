import { describe, expect, it } from "vitest";
import type { PublicShippingAddress } from "@esencia-glow/shared";
import type { CartLineView, CartTotals } from "../cart/cart-view";
import { buildWhatsappOrderMessage } from "./whatsapp-order-message";

const customer = { fullName: "Ana López Ruiz", email: "ana@correo.com", phone: "5512345678" };

const lines: CartLineView[] = [
  { key: "a", itemType: "product", itemId: "1", kind: "product", brand: "Cosrx", name: "Esencia de caracol", variantLabel: "100 ml", priceCents: 38000, quantity: 2, available: true },
  { key: "b", itemType: "product", itemId: "2", kind: "product", name: "Agotado", variantLabel: "", priceCents: 10000, quantity: 1, available: false },
];

const totals: CartTotals = { itemCount: 2, subtotalCents: 76000, shippingCents: 5000, taxCents: 11172, totalCents: 81000 };

const address = {
  fullName: "Ana López Ruiz",
  phone: "5512345678",
  street: "Av. Reforma",
  exteriorNumber: "120",
  interiorNumber: "4B",
  neighborhood: "Juárez",
  city: "Ciudad de México",
  state: "Ciudad de México",
  postalCode: "06600",
  references: "Portón negro",
} as PublicShippingAddress;

describe("buildWhatsappOrderMessage", () => {
  it("lleva los datos de la clienta, los productos, el total y la dirección", () => {
    const message = buildWhatsappOrderMessage({ customer, lines, totals, delivery: "local", address });

    expect(message).toContain("Nombre: Ana López Ruiz");
    expect(message).toContain("Correo: ana@correo.com");
    expect(message).toContain("Celular: 5512345678");
    expect(message).toContain("2 × Cosrx Esencia de caracol (100 ml)");
    expect(message).toContain("Entrega local a domicilio");
    expect(message).toContain("Av. Reforma 120 int. 4B, col. Juárez");
    expect(message).toContain("C.P. 06600");
    expect(message).toContain("Referencias: Portón negro");
    expect(message).toMatch(/Total: .*810/);
  });

  it("no incluye lo agotado", () => {
    expect(buildWhatsappOrderMessage({ customer, lines, totals, delivery: "local", address })).not.toContain("Agotado");
  });

  it("al recoger en tienda no pide dirección y el envío es gratis", () => {
    const message = buildWhatsappOrderMessage({ customer, lines, totals: { ...totals, shippingCents: 0, totalCents: 76000 }, delivery: "pickup", address: null });

    expect(message).toContain("Paso a recogerlo a la tienda.");
    expect(message).toContain("Envío: Gratis");
    expect(message).not.toContain("C.P.");
  });

  it("en envío nacional el envío queda por acordar y el total es sin envío", () => {
    const message = buildWhatsappOrderMessage({ customer, lines, totals: { ...totals, shippingCents: null, totalCents: 76000 }, delivery: "national", address });

    expect(message).toContain("Envío: por acordar");
    expect(message).toContain("Total sin envío");
  });

  it("muestra el cupón y el descuento cuando hay", () => {
    const message = buildWhatsappOrderMessage({ customer, lines, totals: { ...totals, discountCents: 5000, couponCode: "GLOW10" }, delivery: "local", address });

    expect(message).toMatch(/Descuento \(GLOW10\): -.*50/);
  });
});
