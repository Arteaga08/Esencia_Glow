import { describe, expect, it } from "vitest";
import { compact, validateEmail, validateName } from "./validation";

describe("validateEmail", () => {
  it("acepta un correo normal con espacios alrededor", () => {
    expect(validateEmail("  maria.lopez@correo.mx ")).toBeUndefined();
  });

  it("dice qué le falta al correo", () => {
    expect(validateEmail("")).toBe("Falta tu correo.");
    expect(validateEmail("maria.lopez")).toMatch(/falta la @/);
    expect(validateEmail("maria.lopez@correo")).toMatch(/falta el dominio/);
  });
});

describe("validateName", () => {
  it("pide al menos 2 letras", () => {
    expect(validateName("Ma", "Falta")).toBeUndefined();
    expect(validateName("M", "Falta")).toBe("Escribe al menos 2 letras.");
    expect(validateName("   ", "Falta tu nombre.")).toBe("Falta tu nombre.");
  });
});

describe("compact", () => {
  it("quita las claves sin error", () => {
    expect(compact({ a: "mal", b: undefined, c: "" })).toEqual({ a: "mal" });
  });
});
