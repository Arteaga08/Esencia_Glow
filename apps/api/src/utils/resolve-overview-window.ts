import { OverviewRange } from "@esencia-glow/shared";

/**
 * Ventana móvil de la serie de ventas del Resumen del panel (Milestone 2.9)
 * — a diferencia de `resolve-period-start.ts` (periodo CALENDARIO en curso,
 * usado por el ranking de clientes), esto es una ventana que se DESLIZA con
 * `now`: día = últimas 24 h por hora, semana = últimos 7 días por día, mes =
 * últimos 30 días por día, año = últimos 12 meses por mes. Cada cubeta se
 * alinea al inicio de su unidad en hora local del negocio (top de la hora,
 * medianoche local, día 1 del mes) — mismo motivo que en
 * `resolve-period-start.ts`: resolverlo en UTC correría el corte varias
 * horas y un cobro tarde en el día caería en la cubeta equivocada.
 *
 * Archivo self-contained (duplica el patrón de Intl de
 * resolve-period-start.ts/resolve-cycle.ts) en vez de compartir esas
 * funciones — mismo precedente que esos dos archivos entre sí.
 */

const DEFAULT_TIME_ZONE = "America/Mexico_City";

type OverviewUnit = "hour" | "day" | "month";

interface LocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
}

function readLocalDateTime(date: Date, timeZone: string): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: pick("year"), month: pick("month"), day: pick("day"), hour: pick("hour") };
}

/** Diferencia en ms entre la hora local de `timeZone` y UTC en ese instante —
 * calco de resolveOffsetMs en resolve-period-start.ts. */
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

/** `{year,month,day,hour}` local -> instante UTC real, convirtiendo con el
 * offset del propio punto (nunca uno fijo): correcto aunque la zona
 * cambiara de offset entre dos cubetas. */
function localToUtc(local: LocalDateTime, timeZone: string): Date {
  const naive = new Date(Date.UTC(local.year, local.month - 1, local.day, local.hour));
  return new Date(naive.getTime() - resolveOffsetMs(naive, timeZone));
}

/** Resta `amount` unidades a `local` EN EL DOMINIO NAIVE (como si fuera
 * UTC) — JS normaliza desbordes de hora/día/mes solo, así que restar meses
 * cruza años y restar días cruza meses de distinta duración sin tabla
 * propia. */
function subtractUnit(local: LocalDateTime, unit: OverviewUnit, amount: number): LocalDateTime {
  if (unit === "hour") {
    const naive = new Date(Date.UTC(local.year, local.month - 1, local.day, local.hour - amount));
    return {
      year: naive.getUTCFullYear(),
      month: naive.getUTCMonth() + 1,
      day: naive.getUTCDate(),
      hour: naive.getUTCHours(),
    };
  }
  if (unit === "day") {
    const naive = new Date(Date.UTC(local.year, local.month - 1, local.day - amount, local.hour));
    return {
      year: naive.getUTCFullYear(),
      month: naive.getUTCMonth() + 1,
      day: naive.getUTCDate(),
      hour: local.hour,
    };
  }
  const naive = new Date(Date.UTC(local.year, local.month - 1 - amount, 1));
  return { year: naive.getUTCFullYear(), month: naive.getUTCMonth() + 1, day: 1, hour: 0 };
}

/** Trunca `local` al inicio de su unidad (top de la hora, medianoche, día 1
 * del mes) — las cubetas siempre empiezan ahí, nunca a mitad de unidad. */
function floorToUnit(local: LocalDateTime, unit: OverviewUnit): LocalDateTime {
  if (unit === "hour") return { ...local, hour: local.hour };
  if (unit === "day") return { ...local, hour: 0 };
  return { year: local.year, month: local.month, day: 1, hour: 0 };
}

const RANGE_CONFIG: Record<OverviewRange, { unit: OverviewUnit; count: number }> = {
  [OverviewRange.DAY]: { unit: "hour", count: 24 },
  [OverviewRange.WEEK]: { unit: "day", count: 7 },
  [OverviewRange.MONTH]: { unit: "day", count: 30 },
  [OverviewRange.YEAR]: { unit: "month", count: 12 },
};

interface OverviewWindow {
  unit: OverviewUnit;
  /** Inicio (instante UTC) de cada cubeta de la ventana actual, ascendente;
   * la última es la cubeta EN CURSO (parcial). */
  bucketStarts: Date[];
  windowStart: Date;
  previousWindowStart: Date;
  previousWindowEnd: Date;
}

function resolveOverviewWindow(
  range: OverviewRange,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): OverviewWindow {
  const { unit, count } = RANGE_CONFIG[range];
  const currentBucket = floorToUnit(readLocalDateTime(now, timeZone), unit);

  const bucketStarts: Date[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    bucketStarts.push(localToUtc(subtractUnit(currentBucket, unit, i), timeZone));
  }

  const windowStart = bucketStarts[0]!;
  // `windowStart` ya es `currentBucket - (count-1)`; la ventana anterior
  // empieza `count` unidades ANTES de eso, es decir `2*count - 1` antes de
  // `currentBucket`.
  const previousWindowStart = localToUtc(subtractUnit(currentBucket, unit, 2 * count - 1), timeZone);

  return { unit, bucketStarts, windowStart, previousWindowStart, previousWindowEnd: windowStart };
}

export { resolveOverviewWindow };
export type { OverviewWindow, OverviewUnit };
