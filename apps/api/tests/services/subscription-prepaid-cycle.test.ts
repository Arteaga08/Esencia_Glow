import { describe, expect, it } from "vitest";
import {
  compareCycles,
  daysInMonth,
  dayOfMonthInTimeZone,
  isCycleStrictlyBetween,
} from "../../src/services/subscription-prepaid-cycle.js";

/**
 * Módulo puro (Milestone 2.7b) para el job de cajas prepagadas de cuentas
 * anuales: qué ciclo cae DENTRO del período pagado (sin tocar los extremos,
 * que ya los crea/cerrará el webhook) y qué día es hoy en CDMX (para
 * comparar contra el día-ancla propio de la cuenta).
 */
describe("services/subscription-prepaid-cycle — compareCycles", () => {
  it("años distintos deciden el orden", () => {
    expect(compareCycles({ cycleYear: 2026, cycleMonth: 12 }, { cycleYear: 2027, cycleMonth: 1 })).toBeLessThan(0);
  });

  it("mismo año, meses distintos deciden el orden", () => {
    expect(compareCycles({ cycleYear: 2026, cycleMonth: 3 }, { cycleYear: 2026, cycleMonth: 9 })).toBeLessThan(0);
  });

  it("mismo ciclo es 0", () => {
    expect(compareCycles({ cycleYear: 2026, cycleMonth: 9 }, { cycleYear: 2026, cycleMonth: 9 })).toBe(0);
  });
});

describe("services/subscription-prepaid-cycle — isCycleStrictlyBetween", () => {
  const FROM = { cycleYear: 2026, cycleMonth: 9 }; // alta
  const TO = { cycleYear: 2027, cycleMonth: 9 }; // renovación

  it("un ciclo a mitad del período pagado cae DENTRO", () => {
    expect(isCycleStrictlyBetween({ cycleYear: 2027, cycleMonth: 3 }, FROM, TO)).toBe(true);
  });

  it("el ciclo de ALTA (extremo inferior) NO cuenta, lo crea el webhook", () => {
    expect(isCycleStrictlyBetween(FROM, FROM, TO)).toBe(false);
  });

  it("el ciclo de RENOVACIÓN (extremo superior) NO cuenta, lo crea el webhook", () => {
    expect(isCycleStrictlyBetween(TO, FROM, TO)).toBe(false);
  });

  it("un ciclo fuera del período (antes del alta) es false", () => {
    expect(isCycleStrictlyBetween({ cycleYear: 2026, cycleMonth: 6 }, FROM, TO)).toBe(false);
  });

  it("un ciclo fuera del período (después de la renovación) es false", () => {
    expect(isCycleStrictlyBetween({ cycleYear: 2027, cycleMonth: 11 }, FROM, TO)).toBe(false);
  });

  it("cruza el fin de año correctamente (diciembre -> enero)", () => {
    const from = { cycleYear: 2026, cycleMonth: 11 };
    const to = { cycleYear: 2027, cycleMonth: 11 };
    expect(isCycleStrictlyBetween({ cycleYear: 2026, cycleMonth: 12 }, from, to)).toBe(true);
    expect(isCycleStrictlyBetween({ cycleYear: 2027, cycleMonth: 1 }, from, to)).toBe(true);
  });
});

describe("services/subscription-prepaid-cycle — daysInMonth", () => {
  it("febrero de un año no bisiesto tiene 28 días", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it("febrero de un año bisiesto tiene 29 días", () => {
    expect(daysInMonth(2028, 2)).toBe(29);
  });

  it("abril tiene 30 días", () => {
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it("enero tiene 31 días", () => {
    expect(daysInMonth(2026, 1)).toBe(31);
  });

  it("diciembre tiene 31 días", () => {
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe("services/subscription-prepaid-cycle — dayOfMonthInTimeZone", () => {
  it("respeta la zona horaria de CDMX, no UTC", () => {
    // 2026-01-01T04:00:00Z es 2025-12-31T22:00:00 en CDMX (UTC-6): día 31.
    const date = new Date("2026-01-01T04:00:00.000Z");
    expect(dayOfMonthInTimeZone(date)).toBe(31);
  });

  it("un mediodía UTC sin ambigüedad de borde da el mismo día", () => {
    const date = new Date("2026-09-15T12:00:00.000Z");
    expect(dayOfMonthInTimeZone(date)).toBe(15);
  });

  it("acepta una zona horaria explícita distinta de la default", () => {
    const date = new Date("2026-01-01T04:00:00.000Z");
    expect(dayOfMonthInTimeZone(date, "UTC")).toBe(1);
  });
});
