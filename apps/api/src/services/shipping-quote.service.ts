import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { CATALOG_CURRENCY } from "@esencia-glow/shared";
import type { PublicShippingAddress } from "@esencia-glow/shared";
import { ShippingQuote, type ShippingQuoteDocument, type ShippingRateAttrs } from "../models/shipping-quote.model.js";
import { AppError } from "../utils/app-error.js";
import { buildParcel } from "./parcel.js";
import { resolveCartLines, type CartLineInput } from "./cart-resolution.service.js";
import { computeCartFingerprint } from "./cart-fingerprint.js";
import { resolveShippingProvider } from "./shipping-stub-provider.js";
import type { ShippingProviderRate } from "./shipping-provider.js";
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

/**
 * Cotiza el envío contra el `ShippingProvider` resuelto (stub hoy, Skydropx
 * real en 1.9) y persiste la cotización con TTL — el cliente jamás vuelve a
 * mandar un monto: solo un `rateId` opaco que aquí generamos nosotros.
 */
async function createShippingQuote(input: CreateShippingQuoteInput): Promise<ShippingQuoteDocument> {
  const resolvedLines = await resolveCartLines(input.lines);
  const parcel = buildParcel(resolvedLines.flatMap((line) => line.parcelItems));

  const settings = await getSettings();
  const provider = resolveShippingProvider();
  const providerRates = await provider.getRates(input.destination, parcel);

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
    provider: "stub",
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
 */
async function resolveUsableRate(input: ResolveUsableRateInput): Promise<UsableRate> {
  const quote = await ShippingQuote.findOne({ _id: input.quoteId, userId: input.userId });
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
