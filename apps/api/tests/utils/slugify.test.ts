import { describe, expect, it } from "vitest";
import { slugify } from "../../src/utils/slugify.js";

describe("utils/slugify", () => {
  it("quita acentos y la ñ", () => {
    expect(slugify("Serum Facial Coreano Ñoño")).toBe("serum-facial-coreano-nono");
  });

  it("colapsa espacios y símbolos en un solo guión", () => {
    expect(slugify("  Crema  De  Día!! ")).toBe("crema-de-dia");
  });

  it("corta a 80 caracteres sin dejar un guión colgante", () => {
    const slug = slugify("x".repeat(100));
    expect(slug.length).toBe(80);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("un string vacío o solo símbolos produce un slug vacío", () => {
    expect(slugify("")).toBe("");
    expect(slugify("!!!")).toBe("");
  });
});
