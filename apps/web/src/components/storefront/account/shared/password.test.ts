import { describe, expect, it } from "vitest";
import { describeMissing, strengthScore } from "./password";

describe("describeMissing — misma regla que el backend (10 a 72, mayúscula, minúscula y número)", () => {
  it("acepta una contraseña que cumple todo", () => {
    expect(describeMissing("GlowRosa2026")).toBeUndefined();
    expect(describeMissing("Contrasena1")).toBeUndefined();
  });

  it("dice qué falta, no solo que es inválida", () => {
    expect(describeMissing("hola2026ab")).toBe("Te falta una mayúscula.");
    expect(describeMissing("HOLA2026AB")).toBe("Te falta una minúscula.");
    expect(describeMissing("HolaGlowRosa")).toBe("Te falta un número.");
    expect(describeMissing("hola")).toBe("Te falta al menos 10 caracteres, una mayúscula y un número.");
  });

  it("pide 10 caracteres, no 8", () => {
    expect(describeMissing("Glow2026a")).toBe("Te falta al menos 10 caracteres.");
  });

  it("rechaza vacío y pasarse de 72", () => {
    expect(describeMissing("")).toBe("Escribe una contraseña.");
    expect(describeMissing(`Aa1${"x".repeat(70)}`)).toBe("La contraseña no puede pasar de 72 caracteres.");
  });
});

describe("strengthScore", () => {
  it("cuenta las reglas cumplidas", () => {
    expect(strengthScore("")).toBe(0);
    expect(strengthScore("hola")).toBe(1);
    expect(strengthScore("GlowRosa2026")).toBe(4);
  });
});
