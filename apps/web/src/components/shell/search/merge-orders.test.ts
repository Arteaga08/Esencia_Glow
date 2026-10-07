import type { AdminOrder } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { mergeOrders } from "./merge-orders";

const order = (id: string) => ({ id }) as AdminOrder;

describe("mergeOrders", () => {
  it("pone primero el de número y no repite el que coincide por ambos", () => {
    const merged = mergeOrders([order("b")], [order("a"), order("b"), order("c")], 10);
    expect(merged.map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  it("respeta el tope", () => {
    const merged = mergeOrders([], [order("a"), order("b"), order("c")], 2);
    expect(merged.map((item) => item.id)).toEqual(["a", "b"]);
  });
});
