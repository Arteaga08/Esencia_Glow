/**
 * Formas de entrega mientras los pedidos se cierran por WhatsApp. Una sola
 * fuente para el checkout, el mensaje y la página de producto: así los textos y
 * el monto no se contradicen entre pantallas.
 */
type DeliveryMethod = "pickup" | "local" | "national";

/** Entrega a domicilio dentro de la zona local, en centavos. */
const LOCAL_DELIVERY_FEE_CENTS = 5000;

const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  pickup: "Recoger en tienda",
  local: "Entrega local a domicilio",
  national: "Envío nacional",
};

/** Texto corto de cada forma de entrega, para tarjetas y resúmenes. */
const DELIVERY_HINTS: Record<DeliveryMethod, string> = {
  pickup: "Sin costo. Te avisamos por WhatsApp cuándo y dónde recogerlo.",
  local: "Te lo llevamos a tu domicilio por $50.00.",
  national: "El costo y la paquetería se acuerdan por WhatsApp.",
};

/** Costo de envío en centavos; `null` cuando aún no se sabe (se acuerda por WhatsApp). */
function deliveryShippingCents(method: DeliveryMethod): number | null {
  if (method === "pickup") return 0;
  if (method === "local") return LOCAL_DELIVERY_FEE_CENTS;
  return null;
}

/** Recoger en tienda es la única que no necesita dirección. */
function deliveryNeedsAddress(method: DeliveryMethod): boolean {
  return method !== "pickup";
}

export { DELIVERY_HINTS, DELIVERY_LABELS, LOCAL_DELIVERY_FEE_CENTS, deliveryNeedsAddress, deliveryShippingCents };
export type { DeliveryMethod };
