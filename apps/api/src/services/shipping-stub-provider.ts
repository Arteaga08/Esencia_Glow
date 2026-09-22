import { ShippingCarrier } from "@esencia-glow/shared";
import type {
  ShippingCallOptions,
  ShippingLabelResult,
  ShippingProvider,
  ShippingProviderRate,
  ShippingRatesResult,
} from "./shipping-provider.js";
import { ShippingProviderError } from "./shipping-provider-error.js";

/**
 * Adapter stub con tarifas FIJAS — camino de desarrollo y pruebas, nunca el
 * de producción (`selectShippingProvider` lo veta ahí). Construido y
 * testeado desde el día uno para no depender de credenciales reales de
 * Skydropx (ver plan de 1.5). El adapter real implementa la misma interfaz
 * `ShippingProvider`, sin tocar nada de órdenes.
 *
 * Deliberadamente ignora `destination`/`parcel` en el cálculo (más allá de
 * la firma, que si las recibe): son tarifas fijas, no una cotización real.
 */
const STUB_RATES: readonly Omit<ShippingProviderRate, "providerRateId">[] = [
  { carrier: ShippingCarrier.ESTAFETA, service: "Terrestre", amountCents: 12000, estimatedDays: 5 },
  { carrier: ShippingCarrier.FEDEX, service: "Estándar", amountCents: 15000, estimatedDays: 3 },
  { carrier: ShippingCarrier.DHL, service: "Exprés", amountCents: 25000, estimatedDays: 1 },
];

const STUB_RATE_PREFIX = "stub-";
const STUB_SHIPMENT_PREFIX = "stub-shipment-";
const STUB_TRACKING_PREFIX = "STUB-";
const STUB_SHIPMENT_PATTERN = /^stub-shipment-(\d+)-(.+)$/;

/** Una señal ya abortada significa que NADA se envió: `unavailable`, seguro
 * de reintentar. */
function assertNotAborted(options: ShippingCallOptions): void {
  if (options.signal?.aborted) {
    throw new ShippingProviderError("unavailable", "La llamada al proveedor de envíos fue cancelada.");
  }
}

/** El índice de la tarifa viaja en el id del envío para que `getLabel` pueda
 * reconstruir la misma guía sin que el stub guarde estado. */
function buildReadyLabel(orderId: string, rateIndex: number, carrier: ShippingCarrier): ShippingLabelResult {
  return {
    status: "ready",
    providerShipmentId: `${STUB_SHIPMENT_PREFIX}${rateIndex}-${orderId}`,
    trackingNumber: `${STUB_TRACKING_PREFIX}${orderId}`,
    carrier,
    labelUrl: `https://stub.invalid/labels/${orderId}.pdf`,
    trackingUrl: `https://stub.invalid/track/${orderId}`,
  };
}

function createStubShippingProvider(): ShippingProvider {
  return {
    name: "stub",

    async getRates(_destination, _parcel, options): Promise<ShippingRatesResult> {
      assertNotAborted(options);
      return {
        providerQuoteId: "stub-quote",
        rates: STUB_RATES.map((rate, index) => ({
          ...rate,
          providerRateId: `${STUB_RATE_PREFIX}${index}`,
        })),
      };
    },

    async purchaseLabel(input, options): Promise<ShippingLabelResult> {
      assertNotAborted(options);
      const index = STUB_RATES.findIndex((_, i) => `${STUB_RATE_PREFIX}${i}` === input.providerRateId);
      const rate = STUB_RATES[index];
      if (!rate) {
        throw new ShippingProviderError("rejected", `Tarifa desconocida: ${input.providerRateId}`);
      }
      return buildReadyLabel(input.orderId, index, rate.carrier);
    },

    async getLabel(providerShipmentId, options): Promise<ShippingLabelResult> {
      assertNotAborted(options);
      const match = STUB_SHIPMENT_PATTERN.exec(providerShipmentId);
      const rate = match ? STUB_RATES[Number(match[1])] : undefined;
      if (!match || !rate) {
        throw new ShippingProviderError("rejected", `Envío desconocido: ${providerShipmentId}`);
      }
      return buildReadyLabel(match[2]!, Number(match[1]), rate.carrier);
    },
  };
}

export { createStubShippingProvider };
