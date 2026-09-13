import { SubscriptionStatus } from "../enums/subscription-status.js";

/**
 * Etiquetas en español de cada estado, como `Record` exhaustivo — no una
 * función con `default`. Agregar un estado a `SubscriptionStatus` sin
 * etiquetarlo aquí rompe el typecheck en vez de renderizar `undefined` en el
 * panel. Backend y panel (Milestone 2.6) espejan este mapa verbatim — mismo
 * criterio que ORDER_STATUS_LABELS.
 */
const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  [SubscriptionStatus.INCOMPLETE]: "Pendiente de confirmar",
  [SubscriptionStatus.ACTIVE]: "Activa",
  [SubscriptionStatus.PAST_DUE]: "Pago atrasado",
  [SubscriptionStatus.PAUSED]: "Pausada",
  [SubscriptionStatus.CANCELED]: "Cancelada",
};

export { SUBSCRIPTION_STATUS_LABELS };
