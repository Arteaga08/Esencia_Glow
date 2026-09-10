import type { ShippingCarrier } from "../enums/shipping-carrier.js";
import type { Currency } from "../constants/currency.js";
import type { MexicanState } from "../constants/mexican-states.js";

/**
 * Snapshot de dirección de envío + contacto. Compartido por `ShippingQuote`
 * (destino cotizado) y `Order` (dirección congelada al comprar) — el
 * checkout copia SIEMPRE la de la cotización, nunca una que el cliente vuelva
 * a mandar en el payload de la orden, para que un desajuste cotización↔envío
 * sea imposible por construcción.
 */
interface PublicShippingAddress {
  fullName: string;
  phone: string;
  street: string;
  exteriorNumber: string;
  interiorNumber?: string;
  neighborhood: string;
  city: string;
  state: MexicanState;
  postalCode: string;
  references?: string;
}

/** Lo que el cliente manda a `POST /shipping/quotes`. */
type ShippingAddressInput = PublicShippingAddress;

interface PublicParcel {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  volumetricWeightGrams: number;
}

/**
 * Una opción de envío cotizada. `providerRateId` (el id de Skydropx/el stub)
 * NUNCA cruza aquí — `rateId` es opaco y propio, generado por nosotros
 * (ver shipping-quote.service.ts).
 */
interface PublicShippingRate {
  rateId: string;
  carrier: ShippingCarrier;
  service: string;
  amountCents: number;
  currency: Currency;
  estimatedDays: number;
}

interface PublicShippingQuote {
  id: string;
  rates: PublicShippingRate[];
  expiresAt: string;
}

/** Líneas normalizadas para cotizar: lo mismo que el checkout manda después
 * en `POST /orders`, para que el `cartFingerprint` de ambos coincida. */
interface CartLineInput {
  itemType: "product" | "bundle";
  itemId: string;
  quantity: number;
}

export type {
  PublicShippingAddress,
  ShippingAddressInput,
  PublicParcel,
  PublicShippingRate,
  PublicShippingQuote,
  CartLineInput,
};
