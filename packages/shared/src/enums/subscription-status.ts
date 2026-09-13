/**
 * Estado de una `SubscriptionAccount` (Milestone 1.7). El adapter de Stripe
 * (1.7.2) traduce el `status` crudo de una Subscription a estos valores —
 * `incomplete_expired` y `unpaid` mapean a `CANCELED` (con `cancelReason`),
 * no son estados propios (ver subscription-state.ts).
 *
 * `PAST_DUE` sí conserva derechos de suscriptora (Stripe sigue reintentando
 * el cobro, dunning); `PAUSED` no — es la clienta quien decidió no recibir
 * caja este ciclo. Ver `ENTITLED_STATUSES`/`isEntitled` en
 * subscription-state.ts.
 */
enum SubscriptionStatus {
  INCOMPLETE = "incomplete",
  ACTIVE = "active",
  PAST_DUE = "past_due",
  PAUSED = "paused",
  CANCELED = "canceled",
}

export { SubscriptionStatus };
