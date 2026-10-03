import type { PublicSubscriptionEnrollment, PublicSubscriptionPlan } from "@esencia-glow/shared";

type PeriodKey = "month" | "quarter" | "year";

const PERIOD_LABEL: Record<PeriodKey, string> = {
  month: "Mensual",
  quarter: "Trimestral",
  year: "Anual",
};

const PERIOD_MONTHS: Record<PeriodKey, number> = { month: 1, quarter: 3, year: 12 };

interface PeriodView {
  key: PeriodKey;
  label: string;
  /** Precio equivalente por mes, en centavos (redondeado). */
  perMonthCents: number;
  /** Ahorro frente a pagar mes a mes, en porcentaje entero; 0 en el mensual. */
  savingsPercent: number;
  /** "Pagas $1,467 cada 3 meses". */
  chargeLine: string;
}

/** Disponibilidad de la caja: si no se puede contratar, el aviso que se muestra en su lugar. */
interface Availability {
  soldOut: boolean;
  note?: string;
}

/** Pesos sin decimales: los precios del bloque son enteros y las cifras grandes se leen mejor así. */
function formatPesos(cents: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}

function describeCharge(chargeCents: number, months: number): string {
  const amount = formatPesos(chargeCents);
  return months === 1 ? `Pagas ${amount} cada mes` : `Pagas ${amount} cada ${months} meses`;
}

/** Un plan ofrece siempre el mensual; trimestral y anual solo si tienen precio. */
function buildPeriodViews(plan: PublicSubscriptionPlan): PeriodView[] {
  const charges: Array<[PeriodKey, number | undefined]> = [
    ["month", plan.priceCents],
    ["quarter", plan.quarterlyPriceCents],
    ["year", plan.annualPriceCents],
  ];

  return charges.flatMap(([key, chargeCents]) => {
    if (chargeCents === undefined || chargeCents <= 0) return [];
    const months = PERIOD_MONTHS[key];
    const fullPrice = plan.priceCents * months;
    const savings = ((fullPrice - chargeCents) / fullPrice) * 100;
    return [
      {
        key,
        label: PERIOD_LABEL[key],
        perMonthCents: Math.round(chargeCents / months),
        savingsPercent: Math.max(0, Math.round(savings)),
        chargeLine: describeCharge(chargeCents, months),
      },
    ];
  });
}

function formatClosingDate(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", timeZone: "America/Mexico_City" }).format(
    new Date(iso),
  );
}

/** Ventana cerrada o cupo lleno bloquean el alta; con fecha de cierre, se avisa hasta cuándo hay lugar. */
function getAvailability(plan: PublicSubscriptionPlan, enrollment: PublicSubscriptionEnrollment): Availability {
  if (!enrollment.open) {
    return { soldOut: true, note: "Las inscripciones están cerradas por ahora. Abrimos lugares de nuevo pronto." };
  }
  if (plan.soldOut) {
    return { soldOut: true, note: "Esta caja llegó a su cupo por ahora. Abrimos lugares de nuevo pronto." };
  }
  if (enrollment.closesAt) {
    return { soldOut: false, note: `Inscripciones abiertas hasta el ${formatClosingDate(enrollment.closesAt)}.` };
  }
  return { soldOut: false };
}

export { buildPeriodViews, getAvailability, formatPesos };
export type { PeriodKey, PeriodView, Availability };
