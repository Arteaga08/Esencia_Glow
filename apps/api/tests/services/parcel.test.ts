import { describe, expect, it } from "vitest";
import { buildParcel } from "../../src/services/parcel.js";

describe("services/parcel", () => {
  it("suma los pesos de las líneas (por cantidad) y agrega la tara de empaque", () => {
    const parcel = buildParcel([
      { weightGrams: 200, dimensionsCm: { length: 10, width: 10, height: 10 }, quantity: 1 },
    ]);
    expect(parcel.weightGrams).toBe(350); // 200*1 + 150 de tara
  });

  it("multiplica peso y volumen por la cantidad de cada línea", () => {
    const parcel = buildParcel([
      { weightGrams: 100, dimensionsCm: { length: 10, width: 10, height: 10 }, quantity: 2 },
    ]);
    expect(parcel.weightGrams).toBe(350); // 100*2 + 150
    expect(parcel.lengthCm).toBe(15);
    expect(parcel.widthCm).toBe(15);
    expect(parcel.heightCm).toBe(14);
  });

  it("redondea las dimensiones hacia arriba (ceil), nunca hacia abajo", () => {
    const parcel = buildParcel([
      { weightGrams: 200, dimensionsCm: { length: 10, width: 10, height: 10 }, quantity: 1 },
    ]);
    expect(Number.isInteger(parcel.lengthCm)).toBe(true);
    expect(Number.isInteger(parcel.widthCm)).toBe(true);
    expect(Number.isInteger(parcel.heightCm)).toBe(true);
    expect(parcel.lengthCm).toBe(15);
    expect(parcel.widthCm).toBe(15);
    expect(parcel.heightCm).toBe(11);
  });

  it("aplica la caja mínima cuando el cubo estimado es más chico que ella", () => {
    const parcel = buildParcel([
      { weightGrams: 50, dimensionsCm: { length: 2, width: 2, height: 2 }, quantity: 1 },
    ]);
    expect(parcel.lengthCm).toBeGreaterThanOrEqual(15);
    expect(parcel.widthCm).toBeGreaterThanOrEqual(15);
    expect(parcel.heightCm).toBeGreaterThanOrEqual(5);
  });

  it("el artículo más grande SIEMPRE cabe: su dimensión mayor nunca queda por debajo de la caja", () => {
    const parcel = buildParcel([
      { weightGrams: 100, dimensionsCm: { length: 5, width: 5, height: 30 }, quantity: 1 },
    ]);
    expect(parcel.heightCm).toBeGreaterThanOrEqual(30);
  });

  it("con varias líneas, cada dimensión respeta el máximo individual entre todas las líneas", () => {
    const parcel = buildParcel([
      { weightGrams: 100, dimensionsCm: { length: 10, width: 10, height: 10 }, quantity: 1 },
      { weightGrams: 50, dimensionsCm: { length: 5, width: 5, height: 25 }, quantity: 1 },
    ]);
    expect(parcel.heightCm).toBeGreaterThanOrEqual(25);
    expect(parcel.weightGrams).toBe(100 + 50 + 150);
  });

  it("calcula el peso volumétrico como ceil(L*W*H/5000) en gramos", () => {
    const parcel = buildParcel([
      { weightGrams: 200, dimensionsCm: { length: 10, width: 10, height: 10 }, quantity: 1 },
    ]);
    const expected = Math.ceil((parcel.lengthCm * parcel.widthCm * parcel.heightCm) / 5000) * 1000;
    expect(parcel.volumetricWeightGrams).toBe(expected);
    expect(parcel.volumetricWeightGrams).toBeGreaterThan(0);
  });

  it("un carrito vacío no puede armar un paquete", () => {
    expect(() => buildParcel([])).toThrowError(expect.objectContaining({ statusCode: 400 }));
  });
});
