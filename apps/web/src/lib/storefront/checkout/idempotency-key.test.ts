import { describe, expect, it } from "vitest";
import { fingerprintOrder, resolveIdempotencyKey, type KeyStorage } from "./idempotency-key";

function memoryStorage(): KeyStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value), removeItem: (key) => void data.delete(key) };
}

const LINES = [
  { itemType: "product" as const, itemId: "a1", quantity: 2 },
  { itemType: "bundle" as const, itemId: "b2", quantity: 1 },
];

describe("fingerprintOrder", () => {
  it("no depende del orden de las líneas", () => {
    const one = fingerprintOrder({ lines: LINES, quoteId: "q", rateId: "r" });
    const other = fingerprintOrder({ lines: [...LINES].reverse(), quoteId: "q", rateId: "r" });
    expect(one).toBe(other);
  });

  it("cambia con la cantidad, la cotización o la tarifa", () => {
    const base = fingerprintOrder({ lines: LINES, quoteId: "q", rateId: "r" });
    expect(fingerprintOrder({ lines: [{ ...LINES[0]!, quantity: 3 }, LINES[1]!], quoteId: "q", rateId: "r" })).not.toBe(base);
    expect(fingerprintOrder({ lines: LINES, quoteId: "q2", rateId: "r" })).not.toBe(base);
    expect(fingerprintOrder({ lines: LINES, quoteId: "q", rateId: "r2" })).not.toBe(base);
  });
});

describe("resolveIdempotencyKey", () => {
  it("reintentar lo mismo reutiliza la llave (replay); cambiar algo genera otra", () => {
    const storage = memoryStorage();
    let counter = 0;
    const make = () => `uuid-${++counter}`;

    const first = resolveIdempotencyKey(storage, "huella-1", make);
    expect(resolveIdempotencyKey(storage, "huella-1", make)).toBe(first);
    expect(resolveIdempotencyKey(storage, "huella-2", make)).not.toBe(first);
  });

  it("un valor guardado roto se ignora y se genera uno nuevo", () => {
    const storage = memoryStorage();
    storage.setItem("esencia-glow:checkout-key:v1", "{no es json");
    expect(resolveIdempotencyKey(storage, "huella", () => "nueva")).toBe("nueva");
  });

  it("sin almacenamiento sigue funcionando", () => {
    expect(resolveIdempotencyKey(null, "huella", () => "sola")).toBe("sola");
  });
});
