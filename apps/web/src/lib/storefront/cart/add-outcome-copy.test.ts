import { describe, expect, it } from "vitest";
import { describeAddOutcome } from "./add-outcome-copy";

describe("describeAddOutcome", () => {
  it("no avisa nada cuando se agregó", () => {
    expect(describeAddOutcome("added", "product")).toBeNull();
  });

  it("el tope por línea nombra el máximo según el tipo", () => {
    expect(describeAddOutcome("capped", "product")).toContain("10");
    expect(describeAddOutcome("capped", "bundle")).toContain("20");
  });

  it("el carrito lleno pide quitar algo", () => {
    expect(describeAddOutcome("full", "product")).toContain("Quita alguno");
  });
});
