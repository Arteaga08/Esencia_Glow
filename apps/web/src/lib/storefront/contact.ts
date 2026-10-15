/**
 * Los dos WhatsApp de la tienda (formato wa.me: 52 + 10 dígitos, sin signos).
 * Los dos números son PROVISIONALES (de pruebas, el de Manuel): reemplazarlos
 * por los reales de la clienta antes de lanzar.
 *
 * - Tienda: pedidos del checkout y dudas de envío.
 * - Asesoría: el bloque de asesoría del home y el pie del menú móvil.
 */
const STORE_WHATSAPP_NUMBER = "526623298458";
const ADVICE_WHATSAPP_NUMBER = "526623298458";

const STORE_WHATSAPP_MESSAGE = "Hola, tengo una pregunta sobre un pedido.";
const ADVICE_WHATSAPP_MESSAGE = "Hola, quiero asesoría para elegir mis productos.";

function buildWhatsappHref(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

const STORE_WHATSAPP_HREF = buildWhatsappHref(STORE_WHATSAPP_NUMBER, STORE_WHATSAPP_MESSAGE);
const ADVICE_WHATSAPP_HREF = buildWhatsappHref(ADVICE_WHATSAPP_NUMBER, ADVICE_WHATSAPP_MESSAGE);

/** WhatsApp de la tienda con un mensaje ya escrito (el pedido de la clienta). */
function whatsappHref(message: string): string {
  return buildWhatsappHref(STORE_WHATSAPP_NUMBER, message);
}

export { STORE_WHATSAPP_HREF, ADVICE_WHATSAPP_HREF, whatsappHref };
