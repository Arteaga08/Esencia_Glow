import type { PublicCartLine } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { addLine, EMPTY_CART, type CartItemInput } from "./cart-store";
import { buildCartView, computeTotals } from "./cart-view";

function item(id: string, overrides: Partial<CartItemInput> = {}): CartItemInput {
  return {
    itemType: "product",
    itemId: id,
    snapshot: { name: `Producto ${id}`, brand: "Glow Lab", variantLabel: "30 ml", priceCents: 10000, slug: `p-${id}` },
    ...overrides,
  };
}

const cart = addLine(addLine(EMPTY_CART, item("a"), 2).cart, item("k", { itemType: "bundle" }), 1).cart;

describe("buildCartView", () => {
  it("sin datos vivos pinta el snapshot y asume disponible", () => {
    const view = buildCartView(cart, null);
    expect(view).toHaveLength(2);
    expect(view[0]).toMatchObject({
      key: "product:a",
      kind: "product",
      name: "Producto a",
      priceCents: 10000,
      quantity: 2,
      available: true,
    });
    expect(view[1]).toMatchObject({ key: "bundle:k", kind: "kit" });
  });

  it("el precio y el nombre vivos reemplazan al snapshot", () => {
    const live: PublicCartLine[] = [
      { itemType: "product", itemId: "a", available: true, name: "Nombre nuevo", variantLabel: "50 ml", priceCents: 12000, listPriceCents: 15000, image: { url: "https://x/y.jpg" } },
    ];
    const view = buildCartView(cart, live);
    expect(view[0]).toMatchObject({ name: "Nombre nuevo", variantLabel: "50 ml", priceCents: 12000, listPriceCents: 15000, available: true });
    expect(view[0]!.image).toEqual({ url: "https://x/y.jpg", alt: "Nombre nuevo" });
  });

  it("una línea agotada conserva los datos y queda available false", () => {
    const live: PublicCartLine[] = [{ itemType: "product", itemId: "a", available: false, name: "Producto a", variantLabel: "30 ml", priceCents: 10000 }];
    expect(buildCartView(cart, live)[0]!.available).toBe(false);
  });

  it("una línea que ya no se vende (sin datos) se pinta con el snapshot y available false", () => {
    const live: PublicCartLine[] = [{ itemType: "product", itemId: "a", available: false }];
    const line = buildCartView(cart, live)[0]!;
    expect(line).toMatchObject({ available: false, name: "Producto a", priceCents: 10000 });
  });

  it("una línea que la respuesta no trae se trata como la del snapshot", () => {
    const view = buildCartView(cart, []);
    expect(view.every((line) => line.available)).toBe(true);
  });
});

describe("computeTotals", () => {
  const view = buildCartView(cart, [
    { itemType: "product", itemId: "a", available: true, name: "A", variantLabel: "x", priceCents: 10000 },
    { itemType: "bundle", itemId: "k", available: false, name: "K", variantLabel: "2 productos", priceCents: 50000 },
  ]);

  it("suma solo lo disponible y desglosa el IVA incluido (16 %)", () => {
    const totals = computeTotals(view, null);
    expect(totals.subtotalCents).toBe(20000);
    expect(totals.itemCount).toBe(2);
    expect(totals.totalCents).toBe(20000);
    // neto = round(20000 * 10000 / 11600) = 17241 ; IVA = 20000 - 17241
    expect(totals.taxCents).toBe(2759);
    expect(totals.shippingCents).toBeNull();
  });

  it("con envío lo suma al total", () => {
    const totals = computeTotals(view, 9900);
    expect(totals.totalCents).toBe(29900);
    expect(totals.shippingCents).toBe(9900);
  });

  it("un carrito vacío da ceros", () => {
    expect(computeTotals([], null)).toMatchObject({ subtotalCents: 0, totalCents: 0, taxCents: 0, itemCount: 0 });
  });

  describe("con descuento de cupón", () => {
    it("resta el descuento del total y desglosa el IVA del total ya descontado", () => {
      const totals = computeTotals(view, 9900, 3000);
      expect(totals.subtotalCents).toBe(20000);
      expect(totals.discountCents).toBe(3000);
      expect(totals.totalCents).toBe(20000 - 3000 + 9900);
      // neto = round(26900 * 10000 / 11600) ; IVA = total - neto
      expect(totals.taxCents).toBe(26900 - Math.round((26900 * 10_000) / 11_600));
    });

    it("sin descuento no agrega el campo (el carrito sigue igual)", () => {
      expect(computeTotals(view, null)).not.toHaveProperty("discountCents");
      expect(computeTotals(view, null, 0)).not.toHaveProperty("discountCents");
    });

    it("nunca deja el total por debajo de cero", () => {
      expect(computeTotals(view, null, 999999).totalCents).toBe(0);
    });
  });
});
