import { AppError } from "../utils/app-error.js";

/**
 * Ventana de inscripciones (Milestone 1.7.2a) — módulo puro, sin I/O, calcado
 * de subscription-state.ts. Decisión de Manuel: la admin abre y cierra las
 * altas A MANO (no hay apertura automática mensual); esto reemplazó una
 * ventana de "gracia" alrededor del cobro anclado porque, si las
 * inscripciones cierran antes del ancla, el doble cargo en días consecutivos
 * deja de poder ocurrir por construcción.
 */

const DEFAULT_TIME_ZONE = "America/Mexico_City";
const DAY_MS = 24 * 60 * 60 * 1000;

interface EnrollmentWindow {
  enrollmentOpen: boolean;
  enrollmentClosesAt?: Date;
}

/**
 * ¿Puede darse de alta una clienta AHORA? Derivado en lectura, nunca
 * escrito: la ventana se cierra sola al cumplirse `enrollmentClosesAt` sin
 * que nada tenga que voltear `enrollmentOpen` a `false` — mismo criterio que
 * `isEntitled`/`canTransition` en subscription-state.ts. El cierre MANUAL
 * (antes de tiempo) sí voltea `enrollmentOpen` explícitamente, ver
 * subscription-enrollment.service.ts.
 */
function isEnrollmentOpen(now: Date, window: EnrollmentWindow): boolean {
  if (!window.enrollmentOpen) return false;
  if (window.enrollmentClosesAt && now.getTime() >= window.enrollmentClosesAt.getTime()) return false;
  return true;
}

function extractCalendarDate(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" });
  const parts = formatter.formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

/** Fecha calendario tratada como instante UTC — suficiente para un guard en
 * días; la hora exacta del cobro (UTC, ver stripe-subscription-provider.ts)
 * no importa para esta comparación. */
function calendarDateAsInstant(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Próxima ocurrencia del día-ancla en o después de `from`, en `timeZone`.
 * Si `from` cae exactamente en el día-ancla, esa misma fecha cuenta como "la
 * próxima" — interpretación deliberadamente cautelosa para este guard. */
function nextAnchorOnOrAfter(from: Date, anchorDay: number, timeZone: string = DEFAULT_TIME_ZONE): Date {
  const { year, month, day } = extractCalendarDate(from, timeZone);
  if (day <= anchorDay) return calendarDateAsInstant(year, month, anchorDay);

  const nextMonth = calendarDateAsInstant(year, month, 1);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  return calendarDateAsInstant(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, anchorDay);
}

/**
 * Rechaza (409) abrir una ventana cuya "zona de peligro" (los `gapDays` días
 * inmediatamente antes del próximo cobro anclado) se traslapa con el período
 * [opensAt, closesAt) — no solo con `closesAt`: un ancla que cae A MITAD de
 * la ventana es igual de peligrosa para quien se suscribe justo antes de esa
 * fecha, aunque la ventana siga abierta varios días más después. Por eso el
 * ancla se busca desde `opensAt`, no desde `closesAt` — con la ventana más
 * corta que un mes, esa primera ocurrencia es la única que puede traslaparse.
 */
function assertWindowClearOfAnchor(
  opensAt: Date,
  closesAt: Date,
  anchorDay: number,
  gapDays: number,
  timeZone: string = DEFAULT_TIME_ZONE,
): void {
  const nextAnchor = nextAnchorOnOrAfter(opensAt, anchorDay, timeZone);
  const dangerZoneStart = new Date(nextAnchor.getTime() - gapDays * DAY_MS);

  if (dangerZoneStart.getTime() < closesAt.getTime()) {
    throw new AppError(
      `La ventana debe cerrar al menos ${gapDays} días antes del próximo cobro anclado (día ${anchorDay}).`,
      409,
    );
  }
}

export { isEnrollmentOpen, assertWindowClearOfAnchor, nextAnchorOnOrAfter };
export type { EnrollmentWindow };
