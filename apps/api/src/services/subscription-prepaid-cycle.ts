import type { Cycle } from "../utils/resolve-cycle.js";

/**
 * Módulo puro (Milestone 2.7b), sin I/O, calcado de subscription-enrollment.ts
 * — lo usa `jobs/create-prepaid-cycle-shipments.ts` para decidir si HOY toca
 * crear la caja mensual intermedia de una cuenta ANUAL: el webhook de Stripe
 * solo dispara `invoice.paid` una vez al año (al alta y en cada renovación),
 * así que los ciclos 2-12 del período pagado necesitan que un job los cree.
 */

const DEFAULT_TIME_ZONE = "America/Mexico_City";

/** Orden cronológico de dos ciclos: negativo si `a` es anterior a `b`, 0 si
 * son el mismo ciclo, positivo si `a` es posterior. */
function compareCycles(a: Cycle, b: Cycle): number {
  if (a.cycleYear !== b.cycleYear) return a.cycleYear - b.cycleYear;
  return a.cycleMonth - b.cycleMonth;
}

/**
 * ¿`cycle` cae ESTRICTAMENTE dentro de `(from, to)`? Ambos extremos quedan
 * EXCLUIDOS a propósito: el ciclo del alta (`from`) y el de la renovación
 * (`to`) ya los crea el webhook de `invoice.paid` — este job solo cubre los
 * meses intermedios, nunca duplica esos dos.
 */
function isCycleStrictlyBetween(cycle: Cycle, from: Cycle, to: Cycle): boolean {
  return compareCycles(cycle, from) > 0 && compareCycles(cycle, to) < 0;
}

/** Día del mes de `date` en `timeZone` (default Ciudad de México, la del
 * negocio) — mismo criterio de zona horaria que `resolveCycleFromDate`. */
function dayOfMonthInTimeZone(date: Date, timeZone: string = DEFAULT_TIME_ZONE): number {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone, day: "numeric" });
  return Number(formatter.formatToParts(date).find((part) => part.type === "day")?.value);
}

/**
 * Días que tiene `month` (1-12) de `year`. El "día 0 del mes siguiente" es el
 * último día del mes pedido — mismo truco que usa `Date.UTC` para resolver
 * meses de 28/29/30/31 días sin tabla propia.
 *
 * Existe por un bug real (hallazgo de `/code-review`): el ancla de una cuenta
 * ANUAL es un día fijo del mes (el de su propio `currentPeriodEnd`, p. ej.
 * 31 de una alta el 31 de enero). Comparar ese día fijo contra `today` sin
 * acotarlo al mes que se está evaluando deja el guard `today < anchorDay`
 * siempre verdadero en cualquier mes más corto (febrero para ancla 29-31,
 * abril/junio/septiembre/noviembre para ancla 31) — la caja de ESE ciclo
 * nunca se crea, en silencio, para siempre (el reloj avanza de mes antes de
 * que `today` pueda alcanzar nunca ese número).
 */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export { compareCycles, isCycleStrictlyBetween, dayOfMonthInTimeZone, daysInMonth };
