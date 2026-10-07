import { describe, expect, it } from "vitest";
import { filterOptions } from "./select-search";

const OPTIONS = [
  { value: "México", label: "México" },
  { value: "Ciudad de México", label: "Ciudad de México" },
  { value: "Nuevo León", label: "Nuevo León" },
  { value: "Yucatán", label: "Yucatán" },
];

describe("filterOptions", () => {
  it("sin texto devuelve todas", () => {
    expect(filterOptions(OPTIONS, "  ")).toHaveLength(4);
  });

  it("ignora mayúsculas y acentos", () => {
    expect(filterOptions(OPTIONS, "mexico").map((o) => o.value)).toEqual(["México", "Ciudad de México"]);
    expect(filterOptions(OPTIONS, "NUEVO").map((o) => o.value)).toEqual(["Nuevo León"]);
    expect(filterOptions(OPTIONS, "yucatan")).toHaveLength(1);
  });

  it("las que empiezan con el texto van primero", () => {
    expect(filterOptions(OPTIONS, "mex").map((o) => o.value)).toEqual(["México", "Ciudad de México"]);
  });

  it("sin coincidencias devuelve vacío", () => {
    expect(filterOptions(OPTIONS, "zzz")).toEqual([]);
  });
});
