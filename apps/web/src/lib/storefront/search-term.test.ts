import { describe, expect, it } from "vitest";
import { normalizeSearchTerm, SEARCH_MAX_LENGTH } from "./search-term";

describe("normalizeSearchTerm", () => {
  it("quita espacios de sobra y pasa a minúsculas", () => {
    expect(normalizeSearchTerm("  Beauty   of  Joseon ")).toBe("beauty of joseon");
  });

  it("conserva acentos y ñ", () => {
    expect(normalizeSearchTerm("Sérum Niño")).toBe("sérum niño");
  });

  it("con menos de dos letras no hay búsqueda", () => {
    expect(normalizeSearchTerm("")).toBe("");
    expect(normalizeSearchTerm("   ")).toBe("");
    expect(normalizeSearchTerm(" a ")).toBe("");
    expect(normalizeSearchTerm("ab")).toBe("ab");
  });

  it("recorta lo que pase del tope del API", () => {
    expect(normalizeSearchTerm("a".repeat(200))).toHaveLength(SEARCH_MAX_LENGTH);
  });
});
