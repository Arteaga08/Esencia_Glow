/**
 * Vocabulario del DOMINIO para el estado de una disputa/contracargo — el
 * adapter traduce `needs_response`/`warning_needs_response`/etc. de Stripe a
 * estos valores. Un contracargo perdido NO es `refunded`: el dinero se fue
 * por la vía de la disputa, no por un reembolso nuestro.
 */
enum DisputeStatus {
  OPEN = "open",
  WON = "won",
  LOST = "lost",
  WITHDRAWN = "withdrawn",
}

export { DisputeStatus };
