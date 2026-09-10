import type { ShippingCarrier } from "@esencia-glow/shared";
import type { PublicShippingAddress, PublicParcel } from "@esencia-glow/shared";

/**
 * Interfaz angosta que aísla al resto del código de qué proveedor de envíos
 * se usa — mismo patrón que `media-provider.ts`. 1.9 sumará el adapter real
 * de Skydropx y un condicional en `resolveShippingProvider`; hasta entonces
 * solo existe el stub.
 */
interface ShippingProviderRate {
  carrier: ShippingCarrier;
  service: string;
  amountCents: number;
  estimatedDays: number;
  /** El id que el proveedor usaría para reclamar esta tarifa. NUNCA cruza
   * al cliente — solo lo persiste `ShippingQuote` para el adapter real. */
  providerRateId: string;
}

interface ShippingProvider {
  getRates(destination: PublicShippingAddress, parcel: PublicParcel): Promise<ShippingProviderRate[]>;
}

export type { ShippingProvider, ShippingProviderRate };
