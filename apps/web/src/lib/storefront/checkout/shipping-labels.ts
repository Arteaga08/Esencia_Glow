import { SHIPPING_CARRIER_LABELS, type PublicShippingRate } from "@esencia-glow/shared";
import { formatMoneyMXN } from "@/lib/format-money";

function daysLabel(days: number): string {
  return days === 1 ? "Llega en 1 día hábil" : `Llega en ${days} días hábiles`;
}

/** "FedEx Express, $149.00, llega en 2 días hábiles" para los resúmenes de un renglón. */
function rateSummary(rate: Pick<PublicShippingRate, "carrier" | "service" | "amountCents" | "estimatedDays">): string {
  return `${SHIPPING_CARRIER_LABELS[rate.carrier]} ${rate.service}, ${formatMoneyMXN(rate.amountCents)}, ${daysLabel(rate.estimatedDays).toLowerCase()}`;
}

/** La más barata: la que llega preseleccionada al paso de envío. */
function cheapestRate(rates: readonly PublicShippingRate[]): PublicShippingRate {
  return rates.reduce((best, rate) => (rate.amountCents < best.amountCents ? rate : best));
}

function fastestRate(rates: readonly PublicShippingRate[]): PublicShippingRate {
  return rates.reduce((best, rate) => (rate.estimatedDays < best.estimatedDays ? rate : best));
}

export { daysLabel, rateSummary, cheapestRate, fastestRate };
