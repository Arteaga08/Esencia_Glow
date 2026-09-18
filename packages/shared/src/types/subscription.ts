/**
 * Contrato de la clienta para el módulo de suscripciones (Fase 4 de
 * 1.7.2a), mismo criterio que `CheckoutResult` en `order.ts`: solo lo que
 * el front necesita mostrar la leyenda legal antes de confirmar la
 * tarjeta. Los DTOs admin (planes/ediciones) siguen en
 * `apps/api/src/services/subscription-dto.ts` — este es el único contrato
 * de suscripciones que vive en `shared`, porque es el único con una ruta
 * pública hasta ahora.
 *
 * Sin ninguna noción de "activa": eso lo decide únicamente el webhook,
 * nunca la respuesta de este endpoint (mismo criterio que `CheckoutResult`
 * respecto a "pagado").
 */
interface StartSubscriptionResult {
  clientSecret: string;
  firstChargeCents: number;
  currency: string;
  nextChargeAt: string;
}

export type { StartSubscriptionResult };
