import type { ShippingCarrier } from "@esencia-glow/shared";
import type { PublicShippingAddress, PublicParcel } from "@esencia-glow/shared";
import { env } from "../config/env.js";
import { ShippingProviderError } from "./shipping-provider-error.js";
import { createStubShippingProvider } from "./shipping-stub-provider.js";

/**
 * Interfaz angosta que aísla al resto del código de qué proveedor de envíos
 * se usa — mismo patrón que `payment-provider.ts`. Hoy solo existe el stub;
 * 1.9b suma el adapter real de Skydropx y la rama `real` de
 * `resolveShippingProvider`.
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

interface ShippingRatesResult {
  /** Id de la cotización del proveedor, si tiene uno (Skydropx cotiza de
   * forma asíncrona y cada tarifa cuelga de una cotización). */
  providerQuoteId?: string;
  rates: ShippingProviderRate[];
}

/** Opciones de cada llamada: `signal` es el deadline que pone el LLAMADOR
 * (la cotización tiene su propio timeout; la compra de guía, otro). */
interface ShippingCallOptions {
  signal?: AbortSignal;
}

interface PurchaseLabelInput {
  orderId: string;
  orderNumber: string;
  providerRateId: string;
  providerQuoteId?: string;
  origin: PublicShippingAddress;
  destination: PublicShippingAddress;
  parcel: PublicParcel;
  /** Estable por pedido: un adapter que la soporte evita la doble compra
   * ante un reintento de red. */
  idempotencyKey: string;
}

/**
 * Resultado de comprar (o consultar) una guía. `processing` existe porque
 * Skydropx genera la guía de forma asíncrona: ya hay un `providerShipmentId`
 * (ya se cobró) pero el PDF/tracking aún no están listos — desde ahí solo se
 * consulta, JAMÁS se vuelve a comprar.
 */
type ShippingLabelResult =
  | {
      status: "ready";
      providerShipmentId: string;
      trackingNumber: string;
      carrier: ShippingCarrier;
      labelUrl: string;
      trackingUrl?: string;
    }
  | { status: "processing"; providerShipmentId: string };

interface ShippingProvider {
  readonly name: "stub" | "skydropx";
  getRates(
    destination: PublicShippingAddress,
    parcel: PublicParcel,
    options: ShippingCallOptions,
  ): Promise<ShippingRatesResult>;
  purchaseLabel(input: PurchaseLabelInput, options: ShippingCallOptions): Promise<ShippingLabelResult>;
  getLabel(providerShipmentId: string, options: ShippingCallOptions): Promise<ShippingLabelResult>;
}

/**
 * Decisión pura de qué proveedor usar. En producción SIN adapter real
 * devuelve `undefined` (el llamador responde 503): el stub tiene tarifas
 * inventadas y jamás debe cobrarle a una clienta real. Fuera de producción,
 * un adapter real configurado (sandbox) tiene prioridad sobre el stub.
 */
function selectShippingProvider(input: {
  isProduction: boolean;
  real: ShippingProvider | undefined;
  stub: ShippingProvider;
}): ShippingProvider | undefined {
  if (input.real) return input.real;
  return input.isProduction ? undefined : input.stub;
}

/**
 * Seam de pruebas — mismo contrato que `__setPaymentProviderForTests`:
 * `"unset"` distingue "nunca se llamó" de "se llamó con `undefined`" (para
 * probar el 503 explícitamente).
 */
let testOverride: ShippingProvider | undefined | "unset" = "unset";

function __setShippingProviderForTests(provider: ShippingProvider | undefined): void {
  if (!env.isTest) {
    throw new Error("__setShippingProviderForTests solo puede usarse en NODE_ENV=test");
  }
  testOverride = provider;
}

function resolveShippingProvider(): ShippingProvider | undefined {
  if (env.isTest && testOverride !== "unset") return testOverride;
  // 1.9b: aquí entra el adapter real cuando `isSkydropxConfigured()`.
  return selectShippingProvider({
    isProduction: env.isProduction,
    real: undefined,
    stub: createStubShippingProvider(),
  });
}

export { ShippingProviderError, selectShippingProvider, resolveShippingProvider, __setShippingProviderForTests };
export type {
  ShippingProvider,
  ShippingProviderRate,
  ShippingRatesResult,
  ShippingCallOptions,
  PurchaseLabelInput,
  ShippingLabelResult,
};
