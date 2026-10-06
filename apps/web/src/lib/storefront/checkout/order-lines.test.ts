import { describe, expect, it } from "vitest";
import type { CartLineView } from "../cart/cart-view";
import { linesKeyOf, toOrderLines } from "./order-lines";

function view(overrides: Partial<CartLineView>): CartLineView {
  return { key: "product:a", itemType: "product", itemId: "a", kind: "product", name: "Sérum", variantLabel: "30 ml", priceCents: 34900, quantity: 1, available: true, ...overrides };
}

describe("toOrderLines", () => {
  it("manda solo QUÉ y cuánto: tipo, id y cantidad, nunca precios", () => {
    expect(toOrderLines([view({ quantity: 2 })])).toEqual([{ itemType: "product", itemId: "a", quantity: 2 }]);
  });

  it("deja fuera lo agotado: no se puede comprar", () => {
    const lines = [view({}), view({ key: "bundle:k", itemType: "bundle", itemId: "k", kind: "kit", available: false })];
    expect(toOrderLines(lines)).toEqual([{ itemType: "product", itemId: "a", quantity: 1 }]);
  });
});

describe("linesKeyOf", () => {
  it("no depende del orden y cambia con la cantidad", () => {
    const a = { itemType: "product" as const, itemId: "a", quantity: 1 };
    const b = { itemType: "bundle" as const, itemId: "b", quantity: 2 };
    expect(linesKeyOf([a, b])).toBe(linesKeyOf([b, a]));
    expect(linesKeyOf([a, b])).not.toBe(linesKeyOf([{ ...a, quantity: 2 }, b]));
    expect(linesKeyOf([])).toBe("");
  });
});
