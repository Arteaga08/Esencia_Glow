import { CouponDiscountType, type CreateCouponInput } from "@esencia-glow/shared";

/**
 * Conversión del formulario de cupones (texto libre) al cuerpo que entiende el
 * API. Solo convierte y atrapa lo que no se puede ni enviar (un número mal
 * escrito); las reglas de negocio (rangos, fechas, código repetido) las
 * valida el servidor y vuelven pegadas a su campo.
 */

interface CouponFormValues {
  code: string;
  description: string;
  discountType: CouponDiscountType;
  /** Porcentaje entero, o pesos si es monto fijo. */
  value: string;
  /** Pesos. */
  minSubtotal: string;
  /** `yyyy-mm-dd`, como lo entrega `<input type="date">`. */
  startsAt: string;
  endsAt: string;
  maxCustomers: string;
  perCustomerLimit: string;
}

const EMPTY_COUPON_FORM: CouponFormValues = {
  code: "",
  description: "",
  discountType: CouponDiscountType.PERCENT,
  value: "",
  minSubtotal: "",
  startsAt: "",
  endsAt: "",
  maxCustomers: "",
  perCustomerLimit: "1",
};

type CouponInputResult = { ok: true; input: CreateCouponInput } | { ok: false; errors: Record<string, string> };

/**
 * "100", "1,250.50" o "$80" a centavos enteros; cualquier otra cosa da `null`.
 * A diferencia de `pesosInputToCents` (format-money), NO redondea: "10.999" es
 * un error, no $11.00 — un descuento no debe cambiar de valor en silencio.
 */
function pesosToCents(raw: string): number | null {
  const cleaned = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [pesos = "0", cents = ""] = cleaned.split(".");
  return Number(pesos) * 100 + Number(cents.padEnd(2, "0"));
}

// México no tiene horario de verano desde 2022: el desfase es fijo en -06:00.
const MX_OFFSET = "-06:00";

function toStartOfDay(date: string): string {
  return `${date}T00:00:00${MX_OFFSET}`;
}

function toEndOfDay(date: string): string {
  return `${date}T23:59:59${MX_OFFSET}`;
}

function toCouponInput(values: CouponFormValues, options: { personal?: boolean } = {}): CouponInputResult {
  const errors: Record<string, string> = {};
  const input: CreateCouponInput = { code: values.code.trim(), discountType: values.discountType };

  const description = values.description.trim();
  if (description) input.description = description;

  const value = values.value.trim();
  if (values.discountType === CouponDiscountType.PERCENT) {
    if (/^\d{1,3}$/.test(value)) input.percentOff = Number(value);
    else errors.percentOff = "Escribe el porcentaje de descuento, solo números.";
  } else {
    const cents = pesosToCents(value);
    if (cents !== null) input.amountOffCents = cents;
    else errors.amountOffCents = "Escribe el monto del descuento en pesos, por ejemplo 100 o 99.50.";
  }

  if (values.minSubtotal.trim()) {
    const cents = pesosToCents(values.minSubtotal);
    if (cents !== null) input.minSubtotalCents = cents;
    else errors.minSubtotalCents = "Escribe el mínimo de compra en pesos, por ejemplo 800.";
  }

  if (values.startsAt) input.startsAt = toStartOfDay(values.startsAt);
  if (values.endsAt) input.endsAt = toEndOfDay(values.endsAt);

  if (!options.personal && values.maxCustomers.trim()) {
    if (/^\d+$/.test(values.maxCustomers.trim())) input.maxCustomers = Number(values.maxCustomers.trim());
    else errors.maxCustomers = "Escribe cuántas personas pueden usarlo, solo números.";
  }

  const perCustomer = values.perCustomerLimit.trim();
  if (!perCustomer) input.perCustomerLimit = 1;
  else if (/^\d+$/.test(perCustomer)) input.perCustomerLimit = Number(perCustomer);
  else errors.perCustomerLimit = "Escribe cuántas veces puede usarlo cada clienta, solo números enteros.";

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, input };
}

export { EMPTY_COUPON_FORM, pesosToCents, toCouponInput };
export type { CouponFormValues, CouponInputResult };
