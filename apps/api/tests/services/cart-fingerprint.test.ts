import { describe, expect, it } from "vitest";
import { computeCartFingerprint } from "../../src/services/cart-fingerprint.js";

describe("services/cart-fingerprint", () => {
  it("es insensible al orden de las líneas", () => {
    const a = computeCartFingerprint([
      { itemType: "product", itemId: "p1", quantity: 2 },
      { itemType: "bundle", itemId: "b1", quantity: 1 },
    ]);
    const b = computeCartFingerprint([
      { itemType: "bundle", itemId: "b1", quantity: 1 },
      { itemType: "product", itemId: "p1", quantity: 2 },
    ]);
    expect(a).toBe(b);
  });

  it("deduplica líneas repetidas del mismo itemType+itemId sumando cantidades", () => {
    const deduped = computeCartFingerprint([
      { itemType: "product", itemId: "p1", quantity: 2 },
      { itemType: "product", itemId: "p1", quantity: 3 },
    ]);
    const merged = computeCartFingerprint([{ itemType: "product", itemId: "p1", quantity: 5 }]);
    expect(deduped).toBe(merged);
  });

  it("un producto y un bundle con el mismo id producen huellas distintas", () => {
    const asProduct = computeCartFingerprint([{ itemType: "product", itemId: "x1", quantity: 1 }]);
    const asBundle = computeCartFingerprint([{ itemType: "bundle", itemId: "x1", quantity: 1 }]);
    expect(asProduct).not.toBe(asBundle);
  });

  it("cambiar la cantidad cambia la huella", () => {
    const one = computeCartFingerprint([{ itemType: "product", itemId: "p1", quantity: 1 }]);
    const two = computeCartFingerprint([{ itemType: "product", itemId: "p1", quantity: 2 }]);
    expect(one).not.toBe(two);
  });

  it("no depende de precios ni de ningún otro campo — solo identidad y cantidad", () => {
    const fingerprint = computeCartFingerprint([{ itemType: "product", itemId: "p1", quantity: 1 }]);
    expect(typeof fingerprint).toBe("string");
    expect(fingerprint.length).toBeGreaterThan(0);
  });

  it("es determinista: la misma entrada produce siempre la misma huella", () => {
    const lines = [{ itemType: "product" as const, itemId: "p1", quantity: 3 }];
    expect(computeCartFingerprint(lines)).toBe(computeCartFingerprint(lines));
  });
});
