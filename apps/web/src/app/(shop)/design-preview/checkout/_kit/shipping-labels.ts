import { ShippingCarrier, type PublicShippingRate } from "@esencia-glow/shared";
import { formatMoneyMXN } from "@/lib/format-money";

const CARRIER_NAMES: Record<ShippingCarrier, string> = {
  [ShippingCarrier.ESTAFETA]: "Estafeta",
  [ShippingCarrier.FEDEX]: "FedEx",
  [ShippingCarrier.DHL]: "DHL",
  [ShippingCarrier.PAQUETEEXPRESS]: "Paquetexpress",
  [ShippingCarrier.REDPACK]: "Redpack",
};

function daysLabel(days: number): string {
  return days === 1 ? "Llega en 1 día hábil" : `Llega en ${days} días hábiles`;
}

/** "FedEx Express, $149.00, llega en 2 días hábiles" para los resúmenes de un solo renglón. */
function rateSummary(rate: PublicShippingRate): string {
  return `${CARRIER_NAMES[rate.carrier]} ${rate.service}, ${formatMoneyMXN(rate.amountCents)}, ${daysLabel(rate.estimatedDays).toLowerCase()}`;
}

/** La tarifa más barata: la que llega preseleccionada al paso de envío. */
function cheapestRate(rates: PublicShippingRate[]): PublicShippingRate {
  return rates.reduce((best, rate) => (rate.amountCents < best.amountCents ? rate : best));
}

export { CARRIER_NAMES, daysLabel, rateSummary, cheapestRate };
