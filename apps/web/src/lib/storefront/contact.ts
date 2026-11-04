/**
 * Los dos WhatsApp de la tienda (formato wa.me: 52 + 10 dígitos, sin signos).
 * Viven en variables de entorno (no en el repo): `NEXT_PUBLIC_STORE_WHATSAPP` y
 * `NEXT_PUBLIC_ADVICE_WHATSAPP`. Next las incrusta al compilar, así que cambiar
 * un número exige redesplegar el web.
 *
 * - Tienda: pedidos del checkout y dudas de envío.
 * - Asesoría: el bloque de asesoría del home y el pie del menú móvil.
 */
const WHATSAPP_NUMBER_PATTERN = /^52\d{10}$/;

/**
 * Fail-fast, mismo criterio que `lib/config.ts`: un número ausente o mal
 * escrito rompe el arranque, no produce un enlace `wa.me/undefined` en silencio.
 */
function parseWhatsappNumber(raw: string | undefined, name: string): string {
  const value = raw?.trim() ?? "";
  if (!WHATSAPP_NUMBER_PATTERN.test(value)) {
    throw new Error(`${name} debe ser 52 + 10 dígitos, sin signos ni espacios (p. ej. 526621234567). Ver apps/web/.env.example.`);
  }
  return value;
}

// Next solo sustituye `process.env.NEXT_PUBLIC_*` si se escribe el nombre completo.
const STORE_WHATSAPP_NUMBER = parseWhatsappNumber(process.env.NEXT_PUBLIC_STORE_WHATSAPP, "NEXT_PUBLIC_STORE_WHATSAPP");
const ADVICE_WHATSAPP_NUMBER = parseWhatsappNumber(process.env.NEXT_PUBLIC_ADVICE_WHATSAPP, "NEXT_PUBLIC_ADVICE_WHATSAPP");

const STORE_WHATSAPP_MESSAGE = "Hola, tengo una pregunta sobre un pedido.";
const ADVICE_WHATSAPP_MESSAGE = "Hola, quiero asesoría para elegir mis productos.";

function buildWhatsappHref(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** "526621234567" → "662 123 4567": el número como se lee en los textos. */
function formatWhatsappNumber(number: string): string {
  const local = number.slice(-10);
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

const STORE_WHATSAPP_HREF = buildWhatsappHref(STORE_WHATSAPP_NUMBER, STORE_WHATSAPP_MESSAGE);
const STORE_WHATSAPP_DISPLAY = formatWhatsappNumber(STORE_WHATSAPP_NUMBER);
const ADVICE_WHATSAPP_HREF = buildWhatsappHref(ADVICE_WHATSAPP_NUMBER, ADVICE_WHATSAPP_MESSAGE);

/** WhatsApp de la tienda con un mensaje ya escrito (el pedido de la clienta). */
function whatsappHref(message: string): string {
  return buildWhatsappHref(STORE_WHATSAPP_NUMBER, message);
}

export { ADVICE_WHATSAPP_HREF, parseWhatsappNumber, STORE_WHATSAPP_DISPLAY, STORE_WHATSAPP_HREF, whatsappHref };
