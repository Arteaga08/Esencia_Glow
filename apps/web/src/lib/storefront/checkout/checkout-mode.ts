/**
 * Cómo se cierra una compra. `whatsapp`: no hay cobro en línea, el pedido viaja
 * como mensaje a la dueña (mientras no haya datos fiscales para Stripe/Skydropx).
 * `stripe`: el checkout con tarjeta de siempre. Cualquier otro valor, o ninguno,
 * cae en `whatsapp`: es el modo que no cobra nada por accidente.
 */
type CheckoutMode = "whatsapp" | "stripe";

function parseCheckoutMode(raw: string | undefined): CheckoutMode {
  return raw?.trim().toLowerCase() === "stripe" ? "stripe" : "whatsapp";
}

// Next solo sustituye `process.env.NEXT_PUBLIC_*` si se escribe el nombre completo.
const CHECKOUT_MODE = parseCheckoutMode(process.env.NEXT_PUBLIC_CHECKOUT_MODE);

/** Texto del botón del carrito que lleva al checkout. */
const CHECKOUT_CTA_LABEL = CHECKOUT_MODE === "whatsapp" ? "Continuar con mi pedido" : "Continuar al pago";

/** Aviso del panel del carrito sobre cuándo se define el envío. */
const CART_SHIPPING_NOTE =
  CHECKOUT_MODE === "whatsapp" ? "La entrega se elige en el siguiente paso. Los precios ya incluyen IVA." : "El envío se calcula en el siguiente paso. Los precios ya incluyen IVA.";

export { CART_SHIPPING_NOTE, CHECKOUT_CTA_LABEL, CHECKOUT_MODE, parseCheckoutMode };
export type { CheckoutMode };
