import { describe, expect, it } from "vitest";
import { joinName, splitFullName } from "./recipient-name";

describe("splitFullName", () => {
  it("separa en el primer espacio", () => {
    expect(splitFullName("María López Hernández")).toEqual({ firstName: "María", lastName: "López Hernández" });
  });

  it("un solo nombre queda sin apellidos", () => {
    expect(splitFullName("Esencia")).toEqual({ firstName: "Esencia", lastName: "" });
  });

  it("recorta espacios y no rompe con vacío", () => {
    expect(splitFullName("  Ana   Ruiz ")).toEqual({ firstName: "Ana", lastName: "Ruiz" });
    expect(splitFullName("")).toEqual({ firstName: "", lastName: "" });
  });
});

describe("joinName", () => {
  it("une nombre y apellidos recortados", () => {
    expect(joinName(" Ana ", " Ruiz ")).toBe("Ana Ruiz");
    expect(joinName("Ana", "")).toBe("Ana");
  });
});
