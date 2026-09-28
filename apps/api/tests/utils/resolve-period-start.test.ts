import { TopCustomersPeriod } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { resolvePeriodStart } from "../../src/utils/resolve-period-start.js";

// Ciudad de México es UTC-6 fijo (sin horario de verano desde 2022): la
// medianoche local es 06:00Z.
describe("utils/resolvePeriodStart", () => {
  it("semana: arranca el lunes a medianoche de Ciudad de México", () => {
    // Miércoles 30 sep 2026, 12:00 local.
    const now = new Date("2026-09-30T18:00:00Z");
    expect(resolvePeriodStart(TopCustomersPeriod.WEEK, now).toISOString()).toBe("2026-09-28T06:00:00.000Z");
  });

  it("semana: en domingo sigue contando desde el lunes anterior, no desde el día siguiente", () => {
    // Domingo 4 oct 2026, 23:00 local = lunes 5 oct 05:00Z.
    const now = new Date("2026-10-05T05:00:00Z");
    expect(resolvePeriodStart(TopCustomersPeriod.WEEK, now).toISOString()).toBe("2026-09-28T06:00:00.000Z");
  });

  it("mes: el día 1 a medianoche local, aunque en UTC ya sea el mes siguiente", () => {
    // 30 sep 2026, 20:00 local = 1 oct 02:00Z → sigue siendo septiembre.
    const now = new Date("2026-10-01T02:00:00Z");
    expect(resolvePeriodStart(TopCustomersPeriod.MONTH, now).toISOString()).toBe("2026-09-01T06:00:00.000Z");
  });

  it("año: el 1 de enero a medianoche local", () => {
    const now = new Date("2026-09-28T18:00:00Z");
    expect(resolvePeriodStart(TopCustomersPeriod.YEAR, now).toISOString()).toBe("2026-01-01T06:00:00.000Z");
  });
});
