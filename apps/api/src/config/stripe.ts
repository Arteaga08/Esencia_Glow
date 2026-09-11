import Stripe from "stripe";
import { env } from "./env.js";

/**
 * Cliente perezoso de Stripe, mismo patrón que config/cloudinary.ts: no
 * lanza al importarse (sin credenciales en dev), solo cuando de verdad se
 * intenta usar sin configurar (ver services/payment-provider.ts, que
 * responde 503 "Los pagos no están configurados").
 *
 * `apiVersion` fija (nunca "la última del dashboard") para que un cambio de
 * versión de Stripe no altere el shape de las respuestas sin que el código
 * lo espere. `maxNetworkRetries`/`timeout` acotan cuánto tiempo puede
 * colgarse un checkout esperando a un tercero.
 */
const STRIPE_API_VERSION = "2026-08-26.dahlia" as Stripe.LatestApiVersion;

let client: Stripe | undefined;

function isStripeConfigured(): boolean {
  return Boolean(env.stripeSecretKey);
}

function getStripeClient(): Stripe | undefined {
  if (!env.stripeSecretKey) return undefined;
  client ??= new Stripe(env.stripeSecretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    timeout: 10_000,
  });
  return client;
}

export { getStripeClient, isStripeConfigured };
