import { SubscriptionStatus } from "../enums/subscription-status.js";
import { SubscriptionShipmentStatus } from "../enums/subscription-shipment-status.js";

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

/** Mismo criterio exhaustivo para el envío del ciclo: agregar un estado sin
 * etiquetarlo aquí rompe el typecheck (Milestone 1.7.2b). */
const SUBSCRIPTION_SHIPMENT_STATUS_LABELS: Record<SubscriptionShipmentStatus, string> = {
  [SubscriptionShipmentStatus.PENDING]: "Pendiente",
  [SubscriptionShipmentStatus.PROCESSING]: "En preparación",
  [SubscriptionShipmentStatus.SHIPPED]: "Enviada",
  [SubscriptionShipmentStatus.DELIVERED]: "Entregada",
  [SubscriptionShipmentStatus.CANCELED]: "Cancelada",
};

export { SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_SHIPMENT_STATUS_LABELS };
