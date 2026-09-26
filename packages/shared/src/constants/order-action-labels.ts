import { OrderAction } from "../enums/order-action.js";

/**
 * Etiquetas en español de la bitácora de una orden (`GET /:id/activity`),
 * como `Record` exhaustivo — no una función con `default`: agregar una
 * acción a `OrderAction` sin etiquetarla aquí rompe el typecheck en vez de
 * renderizar el `snake_case` crudo en el panel. Redacción en voz de
 * bitácora, legible por quien opera el pedido, no por quien lo programó.
 */
const ORDER_ACTION_LABELS: Record<OrderAction, string> = {
  [OrderAction.ORDER_CREATED]: "Pedido creado",
  [OrderAction.ORDER_PAID]: "Pago confirmado",
  [OrderAction.ORDER_CANCELLED]: "Pedido cancelado",
  [OrderAction.ORDER_EXPIRED]: "Pedido expirado",
  [OrderAction.ORDER_STATUS_CHANGED]: "Estatus actualizado",
  [OrderAction.ORDER_SHIPMENT_UPDATED]: "Guía actualizada",
  [OrderAction.ORDER_SHIPPING_ADDRESS_UPDATED]: "Dirección corregida",
  [OrderAction.ORDER_PRIORITY_UPDATED]: "Prioridad actualizada",
  [OrderAction.ORDER_NOTE_ADDED]: "Nota interna agregada",
  [OrderAction.ORDER_STOCK_INCIDENT]: "Incidencia de inventario",
  [OrderAction.SHIPPING_QUOTED]: "Cotización de envío generada",
  [OrderAction.ORDER_PAYMENT_FAILED]: "Pago rechazado",
  [OrderAction.ORDER_PAYMENT_ANOMALY]: "Anomalía de pago detectada",
  [OrderAction.ORDER_RECONCILED]: "Pago conciliado",
  [OrderAction.ORDER_REFUND_REQUESTED]: "Reembolso solicitado",
  [OrderAction.ORDER_REFUNDED]: "Reembolso aplicado",
  [OrderAction.ORDER_REFUND_FAILED]: "Reembolso rechazado",
  [OrderAction.ORDER_DISPUTED]: "Contracargo abierto",
  [OrderAction.ORDER_DISPUTE_CLOSED]: "Contracargo cerrado",
  [OrderAction.LABEL_REQUESTED]: "Guía solicitada",
  [OrderAction.LABEL_CREATED]: "Guía generada",
  [OrderAction.LABEL_FAILED]: "Guía rechazada por el proveedor",
  [OrderAction.LABEL_NEEDS_REVIEW]: "Guía en revisión",
  [OrderAction.LABEL_RETRY_REQUESTED]: "Reintento de guía solicitado",
  [OrderAction.TRACKING_UPDATED]: "Rastreo actualizado",
  [OrderAction.TRACKING_TRANSITION_SKIPPED_DISPUTE]: "Avance de rastreo pausado por contracargo",
};

export { ORDER_ACTION_LABELS };
