import { describe, expect, it } from "vitest";
import {
  assertWindowClearOfAnchor,
  isEnrollmentOpen,
  resolveAnnualAnchor,
} from "../../src/services/subscription-enrollment.js";

/**
 * Ventana de inscripciones (Milestone 1.7.2a, decisión de Manuel: "la admin
 * abre y cierra a mano"). Módulo puro, sin I/O — calcado de
 * subscription-state.ts.
 */
describe("services/subscription-enrollment — isEnrollmentOpen", () => {
  it("cerrada cuando enrollmentOpen es false, sin importar enrollmentClosesAt", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    const closesAt = new Date("2026-10-01T12:00:00.000Z");
    expect(isEnrollmentOpen(now, { enrollmentOpen: false, enrollmentClosesAt: closesAt })).toBe(false);
  });

  it("abierta cuando enrollmentOpen es true y no hay fecha de cierre", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    expect(isEnrollmentOpen(now, { enrollmentOpen: true })).toBe(true);
  });

  it("abierta cuando enrollmentOpen es true y aún no llega enrollmentClosesAt", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    const closesAt = new Date("2026-09-20T12:00:00.000Z");
    expect(isEnrollmentOpen(now, { enrollmentOpen: true, enrollmentClosesAt: closesAt })).toBe(true);
  });

  it("cerrada sola al cumplirse enrollmentClosesAt, sin que nadie voltee enrollmentOpen", () => {
    const closesAt = new Date("2026-09-20T12:00:00.000Z");
    const now = new Date("2026-09-20T12:00:00.000Z");
    expect(isEnrollmentOpen(now, { enrollmentOpen: true, enrollmentClosesAt: closesAt })).toBe(false);
  });
});

describe("services/subscription-enrollment — assertWindowClearOfAnchor", () => {
  const ANCHOR_DAY = 1;
  const GAP_DAYS = 7;

  it("acepta una ventana con margen suficiente antes del próximo ancla", () => {
    const opensAt = new Date("2026-09-05T12:00:00.000Z");
    const closesAt = new Date("2026-09-20T12:00:00.000Z");
    expect(() => assertWindowClearOfAnchor(opensAt, closesAt, ANCHOR_DAY, GAP_DAYS)).not.toThrow();
  });

  it("acepta el margen exacto (cierra justo GAP_DAYS antes del próximo ancla)", () => {
    const opensAt = new Date("2026-09-05T12:00:00.000Z");
    // Ancla: 1 oct 00:00 UTC (instante calendario) - 7 días = 24 sep 00:00
    // UTC exacto — el límite real, sin margen de hora extra.
    const closesAt = new Date("2026-09-24T00:00:00.000Z");
    expect(() => assertWindowClearOfAnchor(opensAt, closesAt, ANCHOR_DAY, GAP_DAYS)).not.toThrow();
  });

  it("rechaza (409) cuando la ventana cierra a menos de GAP_DAYS del próximo ancla", () => {
    const opensAt = new Date("2026-09-05T12:00:00.000Z");
    const closesAt = new Date("2026-09-27T12:00:00.000Z"); // 4 días antes del ancla del 1 oct
    expect(() => assertWindowClearOfAnchor(opensAt, closesAt, ANCHOR_DAY, GAP_DAYS)).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    );
  });

  it("rechaza cuando el ancla cae A MITAD de la ventana (no solo pegada al cierre)", () => {
    // Ventana 20 sep - 5 oct: el ancla del 1 de octubre cae adentro, a solo
    // 6 días de abrirse la ventana — cualquiera que se suscriba justo antes
    // del 1 de octubre paga dos veces en menos de una semana, sin importar
    // que la ventana siga abierta varios días más.
    const opensAt = new Date("2026-09-20T12:00:00.000Z");
    const closesAt = new Date("2026-10-05T12:00:00.000Z");
    expect(() => assertWindowClearOfAnchor(opensAt, closesAt, ANCHOR_DAY, GAP_DAYS)).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    );
  });
});

/**
 * `resolveAnnualAnchor` (Milestone 2.7b): el mes del ancla anual es SIEMPRE
 * el mes del alta — si el día de hoy ya pasó el día-ancla de este mes, el
 * próximo ancla cae el año que viene (seguro); si todavía no llega, caería
 * en unos días (mismo riesgo de doble cobro que ya documenta
 * assertWindowClearOfAnchor para lo mensual), así que se rechaza.
 */
describe("services/subscription-enrollment — resolveAnnualAnchor", () => {
  const ANCHOR_DAY = 15;

  it("devuelve el mes del alta cuando el día ya pasó el ancla de este mes", () => {
    const now = new Date("2026-09-20T12:00:00.000Z"); // día 20, ancla 15
    expect(resolveAnnualAnchor(now, ANCHOR_DAY)).toBe(9);
  });

  it("rechaza (409) cuando el alta cae ANTES del día-ancla de este mes", () => {
    const now = new Date("2026-09-05T12:00:00.000Z"); // día 5, ancla 15
    expect(() => resolveAnnualAnchor(now, ANCHOR_DAY)).toThrow(expect.objectContaining({ statusCode: 409 }));
  });

  it("rechaza cuando el alta cae EXACTO en el día-ancla de este mes", () => {
    const now = new Date("2026-09-15T12:00:00.000Z");
    expect(() => resolveAnnualAnchor(now, ANCHOR_DAY)).toThrow(expect.objectContaining({ statusCode: 409 }));
  });

  it("respeta la zona horaria de CDMX, no UTC, al cruzar de diciembre a enero", () => {
    // 2026-01-01T04:00:00Z es 2025-12-31T22:00:00 en CDMX (UTC-6): sigue
    // siendo diciembre, día 31 — muy después del ancla del 15.
    const now = new Date("2026-01-01T04:00:00.000Z");
    expect(resolveAnnualAnchor(now, ANCHOR_DAY)).toBe(12);
  });
});
