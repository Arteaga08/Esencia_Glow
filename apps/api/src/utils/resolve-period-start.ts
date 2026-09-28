import { TopCustomersPeriod } from "@esencia-glow/shared";

/**
 * Inicio (instante UTC) del periodo calendario en curso en una zona horaria
 * dada (default Ciudad de México, la del negocio — mismo criterio que
 * `resolve-cycle.ts`): semana desde el lunes, mes desde el día 1, año desde
 * el 1 de enero, siempre a medianoche local. Resolverlo en UTC correría el
 * corte seis horas: un pedido del 30 de septiembre a las 20:00 caería en el
 * ranking de octubre.
 */
const DEFAULT_TIME_ZONE = "America/Mexico_City";

interface LocalDate {
  year: number;
  month: number;
  day: number;
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

function readLocalDate(date: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(pick("year")),
    month: Number(pick("month")),
    day: Number(pick("day")),
    weekday: WEEKDAY_INDEX[pick("weekday")] ?? 0,
  };
}

/** Diferencia en ms entre la hora local de `timeZone` y UTC en ese instante. */
function resolveOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(pick("year"), pick("month") - 1, pick("day"), pick("hour"), pick("minute"), pick("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Medianoche local de `year-month-day` en `timeZone`, como instante UTC. */
function localMidnightToUtc(year: number, month: number, day: number, timeZone: string): Date {
  const naive = new Date(Date.UTC(year, month - 1, day));
  return new Date(naive.getTime() - resolveOffsetMs(naive, timeZone));
}

function resolvePeriodStart(
  period: TopCustomersPeriod,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): Date {
  const local = readLocalDate(now, timeZone);
  if (period === TopCustomersPeriod.YEAR) return localMidnightToUtc(local.year, 1, 1, timeZone);
  if (period === TopCustomersPeriod.MONTH) return localMidnightToUtc(local.year, local.month, 1, timeZone);
  // Date.UTC normaliza un día 0 o negativo al mes anterior.
  return localMidnightToUtc(local.year, local.month, local.day - local.weekday, timeZone);
}

export { resolvePeriodStart };
