import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "./cart-store";
import { addCartItem, clearCart } from "./use-cart";

function stubWindow() {
  const data = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), removeItem: (key: string) => void data.delete(key) },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
  return data;
}

describe("clearCart", () => {
  let data: Map<string, string>;
  beforeEach(() => {
    data = stubWindow();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("vacía el carrito guardado", () => {
    addCartItem({ itemType: "product", itemId: "v1", snapshot: { name: "Sérum", variantLabel: "30 ml", priceCents: 34900 } });
    expect(JSON.parse(data.get(STORAGE_KEY)!).lines).toHaveLength(1);

    clearCart();

    expect(JSON.parse(data.get(STORAGE_KEY)!).lines).toHaveLength(0);
  });
});
