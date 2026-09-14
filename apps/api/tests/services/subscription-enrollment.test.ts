import { describe, expect, it } from "vitest";
import { assertWindowClearOfAnchor, isEnrollmentOpen } from "../../src/services/subscription-enrollment.js";

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
