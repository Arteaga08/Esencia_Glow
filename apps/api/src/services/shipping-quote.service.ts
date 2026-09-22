import { randomBytes } from "node:crypto";
import { Types, type ClientSession } from "mongoose";
import { CATALOG_CURRENCY, SHIPPING_QUOTE_TIMEOUT_MS } from "@esencia-glow/shared";
import type { PublicShippingAddress } from "@esencia-glow/shared";
import { ShippingQuote, type ShippingQuoteDocument, type ShippingRateAttrs } from "../models/shipping-quote.model.js";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/app-error.js";
import { runWithDeadline } from "../utils/run-with-deadline.js";
import { buildParcel } from "./parcel.js";
import { resolveCartLines, type CartLineInput } from "./cart-resolution.service.js";
import { computeCartFingerprint } from "./cart-fingerprint.js";
import {
  ShippingProviderError,
  resolveShippingProvider,
  type ShippingProvider,
  type ShippingProviderRate,
  type ShippingRatesResult,
} from "./shipping-provider.js";
import { getSettings } from "./settings.service.js";

interface CreateShippingQuoteInput {
  userId: string;
  destination: PublicShippingAddress;
  lines: CartLineInput[];
}

interface ResolveUsableRateInput {
  quoteId: string;
  rateId: string;
  userId: string;
  cartFingerprint: string;
}

interface UsableRate {
  quote: ShippingQuoteDocument;
  rate: ShippingRateAttrs;
}

interface CreateShippingQuoteOptions {
  /** Deadline de la llamada al proveedor. Por defecto `SHIPPING_QUOTE_TIMEOUT_MS`. */
  timeoutMs?: number;
}

/**
 * Pide las tarifas al proveedor con un deadline DURO (`runWithDeadline`).
 * Cualquier desenlace que no sea una lista de tarifas se traduce a un error
 * explícito (504 / 502); la cotización nunca se persiste a medias, así que un
 * total jamás se calcula sin una tarifa real.
 */
async function fetchRatesWithDeadline(
  provider: ShippingProvider,
  destination: PublicShippingAddress,
  parcel: ReturnType<typeof buildParcel>,
  timeoutMs: number,
): Promise<ShippingRatesResult> {
  try {
    return await runWithDeadline(
      (signal) => provider.getRates(destination, parcel, { signal }),
      timeoutMs,
      () => new AppError("La cotización de envío tardó demasiado, intenta de nuevo.", 504),
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.warn(
      { err: error, provider: provider.name, kind: error instanceof ShippingProviderError ? error.kind : "unexpected" },
      "Falló la cotización de envío con el proveedor",
    );
    throw new AppError("No pudimos cotizar el envío en este momento.", 502);
  }
}

/**
 * Cotiza el envío contra el `ShippingProvider` resuelto (stub hoy, Skydropx
 * real en 1.9b) y persiste la cotización con TTL — el cliente jamás vuelve a
 * mandar un monto: solo un `rateId` opaco que aquí generamos nosotros.
 */
async function createShippingQuote(
  input: CreateShippingQuoteInput,
  options: CreateShippingQuoteOptions = {},
): Promise<ShippingQuoteDocument> {
  const resolvedLines = await resolveCartLines(input.lines);
  const parcel = buildParcel(resolvedLines.flatMap((line) => line.parcelItems));

  const settings = await getSettings();
  const provider = resolveShippingProvider();
  if (!provider) throw new AppError("Los envíos no están configurados.", 503);

  const { providerQuoteId, rates: providerRates } = await fetchRatesWithDeadline(
    provider,
    input.destination,
    parcel,
    options.timeoutMs ?? SHIPPING_QUOTE_TIMEOUT_MS,
  );
  if (providerRates.length === 0) {
    throw new AppError("No hay opciones de envío para esta dirección.", 422);
  }

  const rates: ShippingRateAttrs[] = providerRates.map((rate: ShippingProviderRate) => ({
    rateId: randomBytes(12).toString("hex"),
    carrier: rate.carrier,
    service: rate.service,
    amountCents: rate.amountCents,
    currency: CATALOG_CURRENCY,
    estimatedDays: rate.estimatedDays,
    providerRateId: rate.providerRateId,
  }));

  const cheapestAmountCents = Math.min(...rates.map((r) => r.amountCents));
  const now = Date.now();
  const expiresAt = new Date(now + settings.commerce.shippingQuoteTtlMinutes * 60_000);
  const purgeAt = new Date(expiresAt.getTime() + 24 * 60 * 60_000);

  return ShippingQuote.create({
    userId: new Types.ObjectId(input.userId),
    cartFingerprint: computeCartFingerprint(input.lines),
    destination: input.destination,
    parcel,
    rates,
    cheapestAmountCents,
    provider: provider.name,
    ...(providerQuoteId ? { providerQuoteId } : {}),
    expiresAt,
    purgeAt,
  });
}

/**
 * Único punto de lectura de una tarifa cotizada. Un `rateId` inexistente,
 * expirado, o de otro usuario se rechaza con el MISMO error genérico — no
 * confirmar cuál de las tres cosas pasó evita filtrar si una cotización
 * ajena existe. Un carrito que cambió desde que se cotizó tiene su propio
 * mensaje, más específico, porque no es un problema de autorización.
 *
 * `session` opcional: el checkout de 1.5 la compone dentro de la
 * transacción de `createOrder` (mismo snapshot que la reserva de stock).
 */
async function resolveUsableRate(input: ResolveUsableRateInput, session?: ClientSession): Promise<UsableRate> {
  const query = ShippingQuote.findOne({ _id: input.quoteId, userId: input.userId });
  if (session) query.session(session);
  const quote = await query;
  const rate = quote?.rates.find((r) => r.rateId === input.rateId);
  const isExpired = !quote || quote.expiresAt.getTime() < Date.now();

  if (!quote || !rate || isExpired) {
    throw new AppError("La opción de envío elegida ya no es válida. Vuelve a cotizar.", 409);
  }

  if (quote.cartFingerprint !== input.cartFingerprint) {
    throw new AppError("Tu carrito cambió, vuelve a cotizar el envío.", 409);
  }

  return { quote, rate };
}

export { createShippingQuote, resolveUsableRate };
export type { CreateShippingQuoteInput, ResolveUsableRateInput, UsableRate };
