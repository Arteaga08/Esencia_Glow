import type { PaymentSettings } from "../types/settings.js";

/**
 * Defaults del singleton de Settings, sección `payments` (Milestone 1.6).
 * Ver types/settings.ts para el razonamiento de cada campo.
 */
const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  oxxoVoucherDays: 2,
  oxxoConfirmationGraceHours: 96,
};

/** Límites de Stripe para OXXO (10.00–10,000.00 MXN), en centavos. */
const OXXO_MIN_AMOUNT_CENTS = 1_000;
const OXXO_MAX_AMOUNT_CENTS = 1_000_000;

/** Ventana de retención de `PaymentEvent` = ventana de dedupe: Stripe
 * reintenta webhooks hasta 3 días en vivo; 60 días deja margen amplio y
 * sirve para investigar una disputa semanas después. */
const PAYMENT_EVENT_RETENTION_DAYS = 60;

/** Margen entre `order.expiresAt` (cuándo el sistema le pregunta a Stripe si
 * cierra el pedido) y `reservation.expiresAt` (red de seguridad del
 * barrendero ciego de 1.4) — el cierre "Stripe-first" debe actuar antes que
 * el barrendero de reservas. */
const RESERVATION_SAFETY_MARGIN_MINUTES = 15;

/** Tope anti card-testing: al 5.º rechazo de tarjeta en el mismo pedido se
 * cancela el intento de pago y el pedido (decisión 10 del plan de 1.6). El
 * mismo número topa los rechazos de una factura de alta de suscripción. Como
 * cada pedido nuevo arranca en 0, el tope entre pedidos lo da
 * `MAX_ACCOUNT_CARD_DECLINES`. */
const MAX_CARD_FAILED_ATTEMPTS = 5;

/** Tope anti card-testing POR CUENTA (auditoría run-2, hallazgo 7): rechazos de
 * tarjeta sumando todos sus pedidos y altas de suscripción dentro de una
 * ventana fija de `ACCOUNT_CARD_DECLINE_WINDOW_HOURS` que arranca con el primer
 * rechazo. Al llegar, la cuenta no puede abrir pedidos, reanudar pagos ni dar
 * de alta una suscripción hasta que la ventana venza. 10 = dos pedidos enteros
 * fallidos: una clienta real casi nunca llega ahí. */
const MAX_ACCOUNT_CARD_DECLINES = 10;
const ACCOUNT_CARD_DECLINE_WINDOW_HOURS = 24;

/** Ventana del lease de `PaymentEvent.lockedAt` (Milestone 1.6.2): una
 * entrega reclamada como `processing` que no termina en este tiempo (caída
 * a medias del proceso) se vuelve reclamable por la siguiente reentrega —
 * Stripe reintenta durante horas, así que 5 minutos es margen amplio para
 * un handler que en el peor caso hace una llamada de red a Stripe. */
const PAYMENT_EVENT_LEASE_MINUTES = 5;

/** Ventana del mutex con lease de `payment.refundRequestedAt` (Milestone
 * 1.6.3, decisión 3 del plan): mientras una solicitud de reembolso está
 * "en vuelo" hacia Stripe, una segunda solicitud concurrente (doble clic,
 * dos pestañas) la ve ocupada y responde 409 en vez de disparar dos
 * reembolsos. Si la llamada a Stripe nunca vuelve (proceso caído a medio
 * camino), el lease vence y una nueva solicitud puede reclamarlo — igual
 * que `PAYMENT_EVENT_LEASE_MINUTES`, pero más largo porque el paso
 * bloqueante (verificar 2FA + esperar la respuesta de Stripe) es más lento
 * que despachar un webhook. */
const REFUND_REQUEST_LEASE_MINUTES = 30;

export {
  DEFAULT_PAYMENT_SETTINGS,
  OXXO_MIN_AMOUNT_CENTS,
  OXXO_MAX_AMOUNT_CENTS,
  PAYMENT_EVENT_RETENTION_DAYS,
  RESERVATION_SAFETY_MARGIN_MINUTES,
  MAX_CARD_FAILED_ATTEMPTS,
  MAX_ACCOUNT_CARD_DECLINES,
  ACCOUNT_CARD_DECLINE_WINDOW_HOURS,
  PAYMENT_EVENT_LEASE_MINUTES,
  REFUND_REQUEST_LEASE_MINUTES,
};
