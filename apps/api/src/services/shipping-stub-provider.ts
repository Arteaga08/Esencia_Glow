import { ShippingCarrier } from "@esencia-glow/shared";
import type { ShippingProvider, ShippingProviderRate } from "./shipping-provider.js";

/**
 * Adapter stub con tarifas FIJAS — camino de desarrollo y pruebas, nunca el
 * de producción. Construido y testeado desde el día uno para no depender de
 * credenciales reales de Skydropx (ver plan de 1.5). El adapter real entra
 * en 1.9 implementando la misma interfaz `ShippingProvider`, sin tocar nada
 * de órdenes.
 *
 * Deliberadamente ignora `destination`/`parcel` en el cálculo (más allá de
 * la firma, que si las recibe): son tarifas fijas, no una cotización real.
 */
const STUB_RATES: readonly Omit<ShippingProviderRate, "providerRateId">[] = [
  { carrier: ShippingCarrier.ESTAFETA, service: "Terrestre", amountCents: 12000, estimatedDays: 5 },
  { carrier: ShippingCarrier.FEDEX, service: "Estándar", amountCents: 15000, estimatedDays: 3 },
  { carrier: ShippingCarrier.DHL, service: "Exprés", amountCents: 25000, estimatedDays: 1 },
];

function createStubShippingProvider(): ShippingProvider {
  return {
    async getRates(): Promise<ShippingProviderRate[]> {
      return STUB_RATES.map((rate, index) => ({
        ...rate,
        providerRateId: `stub-${index}`,
      }));
    },
  };
}

function resolveShippingProvider(): ShippingProvider {
  // TODO(1.9): condicional a la real de Skydropx cuando haya credenciales
  // configuradas, igual que `resolveMediaProvider` con Cloudinary.
  return createStubShippingProvider();
}

export { createStubShippingProvider, resolveShippingProvider };
