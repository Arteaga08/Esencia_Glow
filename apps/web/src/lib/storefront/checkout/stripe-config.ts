/**
 * Llave PUBLICABLE de Stripe (la única que puede vivir en el navegador). Solo se
 * acepta lo que empieza con `pk_`: una llave secreta (`sk_`) o restringida (`rk_`)
 * pegada por error en `NEXT_PUBLIC_*` se trata como ausente, nunca se usa.
 */
function parsePublishableKey(raw: string | undefined): string | null {
  const value = raw?.trim();
  return value && value.startsWith("pk_") ? value : null;
}

// Next solo sustituye `process.env.NEXT_PUBLIC_*` si se escribe el nombre completo.
const PUBLISHABLE_KEY = parsePublishableKey(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export { parsePublishableKey, PUBLISHABLE_KEY };
