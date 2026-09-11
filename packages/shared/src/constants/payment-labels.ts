import { PaymentState } from "../enums/payment-state.js";
import { PaymentMethod } from "../enums/payment-method.js";
import { DisputeStatus } from "../enums/dispute-status.js";

/**
 * Etiquetas en español, como `Record` exhaustivo — igual que
 * `ORDER_STATUS_LABELS`: agregar un valor al enum sin etiquetarlo aquí
 * rompe el typecheck en vez de renderizar `undefined` en el panel.
 */
const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  [PaymentState.PENDING]: "Pendiente",
  [PaymentState.CAPTURED]: "Cobrado",
  [PaymentState.FAILED]: "Rechazado",
  [PaymentState.CANCELED]: "Cancelado",
  [PaymentState.REFUNDED]: "Reembolsado",
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CARD]: "Tarjeta",
  [PaymentMethod.OXXO]: "OXXO",
};

const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  [DisputeStatus.OPEN]: "Contracargo abierto",
  [DisputeStatus.WON]: "Contracargo ganado",
  [DisputeStatus.LOST]: "Contracargo perdido",
  [DisputeStatus.WITHDRAWN]: "Contracargo retirado",
};

export { PAYMENT_STATE_LABELS, PAYMENT_METHOD_LABELS, DISPUTE_STATUS_LABELS };
