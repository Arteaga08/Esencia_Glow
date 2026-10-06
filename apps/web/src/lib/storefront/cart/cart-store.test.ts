import { MAX_BUNDLE_QUANTITY, MAX_ORDER_LINES } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import {
  EMPTY_CART,
  addLine,
  countItems,
  lineKey,
  maxQuantityFor,
  parseCart,
  removeLine,
  serializeCart,
  setQuantity,
  type CartItemInput,
} from "./cart-store";

function item(id: string, overrides: Partial<CartItemInput> = {}): CartItemInput {
  return {
    itemType: "product",
    itemId: id,
    snapshot: { name: `Producto ${id}`, variantLabel: "30 ml", priceCents: 34900, slug: `producto-${id}` },
    ...overrides,
  };
}

describe("cart-store: addLine", () => {
  it("agrega una línea nueva con la cantidad pedida", () => {
    const { cart, outcome } = addLine(EMPTY_CART, item("a"), 2);
    expect(outcome).toBe("added");
    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({ itemType: "product", itemId: "a", quantity: 2 });
  });

  it("fusiona la misma línea sumando cantidades", () => {
    const first = addLine(EMPTY_CART, item("a"), 2).cart;
    const { cart } = addLine(first, item("a"), 3);
    expect(cart).toHaveLength(1);
    expect(cart[0]!.quantity).toBe(5);
  });

  it("un producto y un kit con el mismo id son líneas distintas", () => {
    const first = addLine(EMPTY_CART, item("a"), 1).cart;
    const { cart } = addLine(first, item("a", { itemType: "bundle" }), 1);
    expect(cart).toHaveLength(2);
  });

  it("al fusionar refresca el snapshot con el más reciente", () => {
    const first = addLine(EMPTY_CART, item("a"), 1).cart;
    const { cart } = addLine(first, item("a", { snapshot: { name: "Nuevo", variantLabel: "30 ml", priceCents: 1 } }), 1);
    expect(cart[0]!.snapshot.name).toBe("Nuevo");
  });

  it("topa un producto en 10 y avisa 'capped'", () => {
    const first = addLine(EMPTY_CART, item("a"), 8).cart;
    const { cart, outcome } = addLine(first, item("a"), 5);
    expect(cart[0]!.quantity).toBe(maxQuantityFor("product"));
    expect(maxQuantityFor("product")).toBe(10);
    expect(outcome).toBe("capped");
  });

  it("ya en el tope no cambia nada y avisa 'capped'", () => {
    const first = addLine(EMPTY_CART, item("a"), 10).cart;
    const { cart, outcome } = addLine(first, item("a"), 1);
    expect(cart).toBe(first);
    expect(outcome).toBe("capped");
  });

  it("un kit topa en MAX_BUNDLE_QUANTITY", () => {
    const { cart, outcome } = addLine(EMPTY_CART, item("k", { itemType: "bundle" }), 99);
    expect(cart[0]!.quantity).toBe(MAX_BUNDLE_QUANTITY);
    expect(outcome).toBe("capped");
  });

  it("con MAX_ORDER_LINES líneas no deja agregar una nueva y avisa 'full'", () => {
    let cart = EMPTY_CART;
    for (let i = 0; i < MAX_ORDER_LINES; i += 1) cart = addLine(cart, item(`id${i}`), 1).cart;
    const result = addLine(cart, item("extra"), 1);
    expect(result.outcome).toBe("full");
    expect(result.cart).toBe(cart);
    // Una línea que ya está sí se puede seguir incrementando.
    expect(addLine(cart, item("id0"), 1).outcome).toBe("added");
  });

  it("ignora cantidades inválidas (< 1 o no enteras)", () => {
    expect(addLine(EMPTY_CART, item("a"), 0).cart).toBe(EMPTY_CART);
    expect(addLine(EMPTY_CART, item("a"), 1.5).cart).toBe(EMPTY_CART);
  });

  it("no muta el carrito anterior", () => {
    const first = addLine(EMPTY_CART, item("a"), 1).cart;
    addLine(first, item("a"), 1);
    expect(first[0]!.quantity).toBe(1);
  });
});

describe("cart-store: setQuantity y removeLine", () => {
  const base = addLine(addLine(EMPTY_CART, item("a"), 1).cart, item("b"), 1).cart;

  it("cambia la cantidad de una línea", () => {
    const cart = setQuantity(base, lineKey("product", "a"), 4);
    expect(cart.find((l) => l.itemId === "a")!.quantity).toBe(4);
    expect(cart.find((l) => l.itemId === "b")!.quantity).toBe(1);
  });

  it("acota la cantidad entre 1 y el tope", () => {
    expect(setQuantity(base, lineKey("product", "a"), 0)[0]!.quantity).toBe(1);
    expect(setQuantity(base, lineKey("product", "a"), 50)[0]!.quantity).toBe(10);
  });

  it("una clave inexistente no cambia nada", () => {
    expect(setQuantity(base, lineKey("product", "zzz"), 3)).toBe(base);
  });

  it("quita una línea por clave", () => {
    const cart = removeLine(base, lineKey("product", "a"));
    expect(cart.map((l) => l.itemId)).toEqual(["b"]);
  });
});

describe("cart-store: countItems", () => {
  it("suma las cantidades de todas las líneas", () => {
    const cart = addLine(addLine(EMPTY_CART, item("a"), 2).cart, item("b"), 3).cart;
    expect(countItems(cart)).toBe(5);
    expect(countItems(EMPTY_CART)).toBe(0);
  });
});

describe("cart-store: serializeCart y parseCart", () => {
  it("hace ida y vuelta sin perder datos", () => {
    const cart = addLine(addLine(EMPTY_CART, item("a"), 2).cart, item("k", { itemType: "bundle" }), 1).cart;
    expect(parseCart(serializeCart(cart))).toEqual(cart);
  });

  it("cae a vacío con null, vacío, JSON roto o una forma ajena", () => {
    for (const raw of [null, "", "{no-json", "42", "null", '{"version":2,"lines":[]}', '{"version":1}']) {
      expect(parseCart(raw)).toEqual(EMPTY_CART);
    }
  });

  it("descarta las líneas corruptas y conserva las buenas", () => {
    const good = addLine(EMPTY_CART, item("a"), 2).cart[0]!;
    const raw = JSON.stringify({
      version: 1,
      lines: [
        good,
        { itemType: "otro", itemId: "x", quantity: 1, snapshot: good.snapshot },
        { itemType: "product", itemId: "x", quantity: "2", snapshot: good.snapshot },
        { itemType: "product", itemId: "y", quantity: 1, snapshot: { name: 5 } },
        null,
      ],
    });
    expect(parseCart(raw)).toEqual([good]);
  });

  it("acota cantidades fuera de rango y colapsa duplicados", () => {
    const { snapshot } = item("a");
    const raw = JSON.stringify({
      version: 1,
      lines: [
        { itemType: "product", itemId: "a", quantity: 999, snapshot },
        { itemType: "product", itemId: "a", quantity: 2, snapshot },
        { itemType: "product", itemId: "b", quantity: -3, snapshot },
      ],
    });
    const cart = parseCart(raw);
    expect(cart).toHaveLength(2);
    expect(cart.find((l) => l.itemId === "a")!.quantity).toBe(10);
    expect(cart.find((l) => l.itemId === "b")!.quantity).toBe(1);
  });

  it("no pasa de MAX_ORDER_LINES líneas", () => {
    const { snapshot } = item("a");
    const lines = Array.from({ length: MAX_ORDER_LINES + 5 }, (_, i) => ({
      itemType: "product",
      itemId: `id${i}`,
      quantity: 1,
      snapshot,
    }));
    expect(parseCart(JSON.stringify({ version: 1, lines }))).toHaveLength(MAX_ORDER_LINES);
  });
});
