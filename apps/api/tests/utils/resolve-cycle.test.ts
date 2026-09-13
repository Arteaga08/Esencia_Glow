import { describe, expect, it } from "vitest";
import { resolveCycleFromDate } from "../../src/utils/resolve-cycle.js";

/**
 * En 1.7.2 el ciclo se deriva del `period_start` (UTC) de una factura de
 * Stripe. Un cobro el 31 de agosto a las 20:00 en Ciudad de México (UTC-5/6)
 * ya es 1 de septiembre en UTC — resolver el ciclo con la zona correcta
 * evita asignarle la caja del mes equivocado.
 */
describe("utils/resolve-cycle", () => {
  it("resuelve un timestamp UTC de mediodía al año/mes correctos en América/Ciudad de México", () => {
    // 15 de septiembre 2026, 12:00 UTC = 15 de septiembre, 06:00 o 07:00 CDMX
    // (mismo día en ambas zonas — caso sin ambigüedad de borde de mes).
    const date = new Date("2026-09-15T12:00:00.000Z");
    expect(resolveCycleFromDate(date)).toEqual({ cycleYear: 2026, cycleMonth: 9 });
  });

  it("un timestamp del 1 de septiembre 02:00 UTC sigue siendo agosto en Ciudad de México (UTC-5)", () => {
    // 2026-09-01T02:00:00Z - 5h = 2026-08-31T21:00 CDMX (horario de verano,
    // Ciudad de México no observa DST, así que su offset es fijo UTC-6 en
    // realidad; usamos un margen de 4 horas para que el caso sea inequívoco
    // sin importar el offset exacto que aplique).
    const date = new Date("2026-09-01T02:00:00.000Z");
    expect(resolveCycleFromDate(date)).toEqual({ cycleYear: 2026, cycleMonth: 8 });
  });

  it("resuelve diciembre 31 cerca de medianoche UTC como diciembre en Ciudad de México", () => {
    const date = new Date("2026-12-31T23:00:00.000Z");
    expect(resolveCycleFromDate(date)).toEqual({ cycleYear: 2026, cycleMonth: 12 });
  });

  it("un timestamp del 1 de enero 03:00 UTC sigue siendo diciembre del año anterior en Ciudad de México", () => {
    const date = new Date("2027-01-01T03:00:00.000Z");
    expect(resolveCycleFromDate(date)).toEqual({ cycleYear: 2026, cycleMonth: 12 });
  });

  it("acepta una zona horaria explícita distinta de la default", () => {
    // En UTC, el mismo instante que en CDMX era 31 de agosto todavía es 1 de
    // septiembre — demuestra que la zona horaria realmente se usa.
    const date = new Date("2026-09-01T02:00:00.000Z");
    expect(resolveCycleFromDate(date, "UTC")).toEqual({ cycleYear: 2026, cycleMonth: 9 });
  });
});
