/**
 * WhatsApp de asesoría de la tienda. El número es PROVISIONAL: reemplazar por
 * el real de la clienta (formato wa.me: 52 + 10 dígitos, sin signos).
 */
const WHATSAPP_NUMBER = "525500000000";
const WHATSAPP_MESSAGE = "Hola, quiero asesoría para elegir mis productos.";
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

/** Enlace de WhatsApp con un mensaje ya escrito (el pedido de la clienta). */
function whatsappHref(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export { WHATSAPP_HREF, whatsappHref };
