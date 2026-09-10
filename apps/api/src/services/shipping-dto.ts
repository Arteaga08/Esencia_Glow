import type { Currency, PublicShippingQuote, PublicShippingRate } from "@esencia-glow/shared";
import type { ShippingQuoteDocument, ShippingRateAttrs } from "../models/shipping-quote.model.js";

/**
 * DTO público de una cotización. `providerRateId` y `cheapestAmountCents`
 * NUNCA cruzan: el primero es un detalle del proveedor (stub hoy, Skydropx
 * en 1.9), el segundo es el ancla interna del cálculo de envío gratis, no
 * algo que el cliente deba ver ni pueda manipular.
 */
function buildPublicShippingRate(rate: ShippingRateAttrs): PublicShippingRate {
  return {
    rateId: rate.rateId,
    carrier: rate.carrier,
    service: rate.service,
    amountCents: rate.amountCents,
    currency: rate.currency as Currency,
    estimatedDays: rate.estimatedDays,
  };
}

function buildPublicShippingQuote(quote: ShippingQuoteDocument): PublicShippingQuote {
  return {
    id: quote._id.toString(),
    rates: quote.rates.map(buildPublicShippingRate),
    expiresAt: quote.expiresAt.toISOString(),
  };
}

export { buildPublicShippingQuote, buildPublicShippingRate };
