import { OverviewRange } from "@esencia-glow/shared";
import { describe, expect, it } from "vitest";
import { resolveOverviewWindow } from "../../src/utils/resolve-overview-window.js";

// Ciudad de México es UTC-6 fijo (sin horario de verano desde 2022): la
// medianoche local es 06:00Z.
describe("utils/resolveOverviewWindow", () => {
  it("día: 24 cubetas por hora, la última es la hora local en curso", () => {
    // Miércoles 30 sep 2026, 14:35 local = 20:35Z.
    const now = new Date("2026-09-30T20:35:00Z");
    const window = resolveOverviewWindow(OverviewRange.DAY, now);

    expect(window.unit).toBe("hour");
    expect(window.bucketStarts).toHaveLength(24);
    // Última cubeta: 14:00 local = 20:00Z.
    expect(window.bucketStarts[23]?.toISOString()).toBe("2026-09-30T20:00:00.000Z");
    // Primera cubeta: 24 h antes.
    expect(window.bucketStarts[0]?.toISOString()).toBe("2026-09-29T21:00:00.000Z");
    expect(window.windowStart).toEqual(window.bucketStarts[0]);
  });

  it("semana: 7 cubetas por día, la última es hoy a medianoche local", () => {
    // Miércoles 30 sep 2026, 14:00 local = 20:00Z.
    const now = new Date("2026-09-30T20:00:00Z");
    const window = resolveOverviewWindow(OverviewRange.WEEK, now);

    expect(window.unit).toBe("day");
    expect(window.bucketStarts).toHaveLength(7);
    // Última cubeta: hoy medianoche local = 06:00Z.
    expect(window.bucketStarts[6]?.toISOString()).toBe("2026-09-30T06:00:00.000Z");
    expect(window.bucketStarts[0]?.toISOString()).toBe("2026-09-24T06:00:00.000Z");
  });

  it("mes: 30 cubetas por día", () => {
    const now = new Date("2026-09-30T20:00:00Z");
    const window = resolveOverviewWindow(OverviewRange.MONTH, now);

    expect(window.unit).toBe("day");
    expect(window.bucketStarts).toHaveLength(30);
    expect(window.bucketStarts[29]?.toISOString()).toBe("2026-09-30T06:00:00.000Z");
    expect(window.bucketStarts[0]?.toISOString()).toBe("2026-09-01T06:00:00.000Z");
  });

  it("año: 12 cubetas por mes, respeta meses de distinta duración", () => {
    const now = new Date("2026-09-30T20:00:00Z");
    const window = resolveOverviewWindow(OverviewRange.YEAR, now);

    expect(window.unit).toBe("month");
    expect(window.bucketStarts).toHaveLength(12);
    // Última cubeta: septiembre 2026, día 1 medianoche local.
    expect(window.bucketStarts[11]?.toISOString()).toBe("2026-09-01T06:00:00.000Z");
    // Primera cubeta: 11 meses antes = octubre 2025.
    expect(window.bucketStarts[0]?.toISOString()).toBe("2025-10-01T06:00:00.000Z");
  });

  it("previousWindowStart/previousWindowEnd cubren la ventana anterior, misma longitud", () => {
    const now = new Date("2026-09-30T20:00:00Z");
    const window = resolveOverviewWindow(OverviewRange.WEEK, now);

    expect(window.previousWindowEnd).toEqual(window.windowStart);
    // 7 días antes de windowStart.
    expect(window.previousWindowStart.toISOString()).toBe("2026-09-17T06:00:00.000Z");
  });
});
