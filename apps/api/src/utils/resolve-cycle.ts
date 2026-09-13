/**
 * Traduce un instante a su `{cycleYear, cycleMonth}` en una zona horaria
 * dada (default Ciudad de México, la del negocio). Existe por 1.7.2: el
 * ciclo de una `SubscriptionEdition`/`SubscriptionShipment` se deriva del
 * `period_start` de una factura de Stripe, que viene en UTC — un cobro el 31
 * de agosto a las 20:00 en Ciudad de México ya es 1 de septiembre en UTC, y
 * resolverlo sin zona horaria le asignaría la caja del mes equivocado, con
 * el agravante de que el índice único `{planId, cycle}` haría que el error
 * se manifieste como un 409 incomprensible semanas después.
 */
interface Cycle {
  cycleYear: number;
  cycleMonth: number;
}

const DEFAULT_TIME_ZONE = "America/Mexico_City";

function resolveCycleFromDate(date: Date, timeZone: string = DEFAULT_TIME_ZONE): Cycle {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return { cycleYear: year, cycleMonth: month };
}

export { resolveCycleFromDate };
export type { Cycle };
