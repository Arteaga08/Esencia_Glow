import { describe, expect, it } from "vitest";
import { addTags, hasTag } from "./tag-list";

describe("addTags", () => {
  it("agrega una etiqueta limpiando espacios", () => {
    expect(addTags([], "  Piel   seca ", [], 10, 40)).toEqual(["Piel seca"]);
  });

  it("separa por comas lo que se pega junto", () => {
    expect(addTags(["Seca"], "Mixta, Grasa,", [], 10, 40)).toEqual(["Seca", "Mixta", "Grasa"]);
  });

  it("no repite una etiqueta aunque cambien las mayúsculas", () => {
    expect(addTags(["Seca"], "seca", [], 10, 40)).toEqual(["Seca"]);
  });

  it("usa la forma ya guardada cuando coincide con una sugerencia", () => {
    expect(addTags([], "mixta", ["Mixta"], 10, 40)).toEqual(["Mixta"]);
  });

  it("respeta el tope de etiquetas y el largo máximo", () => {
    expect(addTags(["A"], "B, C", [], 2, 40)).toEqual(["A", "B"]);
    expect(addTags([], "abcdef", [], 10, 3)).toEqual(["abc"]);
  });
});

describe("hasTag", () => {
  it("compara sin distinguir mayúsculas", () => {
    expect(hasTag(["Sensible"], " sensible ")).toBe(true);
    expect(hasTag(["Sensible"], "Seca")).toBe(false);
  });
});
