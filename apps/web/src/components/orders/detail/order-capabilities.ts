import {
  DisputeStatus,
  ORDER_STATUS_LABELS,
  OrderStatus,
  PaymentMethod,
  REFUND_REQUEST_LEASE_MINUTES,
  ShippingLabelStatus,
  type AdminOrder,
} from "@esencia-glow/shared";

/** Aristas de admin en `order-state.ts` (`ORDER_TRANSITIONS`/`TRANSITION_ACTORS`
 * del backend): `->paid` y `->refunded` son solo del sistema, así que no
 * cuentan aquí — el admin usa el endpoint de reembolso, no una transición. */
const ADMIN_NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  [OrderStatus.PAID]: OrderStatus.PROCESSING,
  [OrderStatus.PROCESSING]: OrderStatus.SHIPPED,
  [OrderStatus.SHIPPED]: OrderStatus.DELIVERED,
};

const NEXT_STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.PAID]: "Marcar en preparación",
  [OrderStatus.PROCESSING]: "Marcar como enviada",
  [OrderStatus.SHIPPED]: "Marcar como entregada",
};

/** Estados de guía en los que corregir la dirección ya no es seguro: el
 * proveedor pudo haber comprado con la dirección vieja. */
const ADDRESS_LOCKED_LABEL_STATUSES: ShippingLabelStatus[] = [
  ShippingLabelStatus.REQUESTED,
  ShippingLabelStatus.PROCESSING,
  ShippingLabelStatus.READY,
];

/** Estados de orden que ya cerraron el envío — corregir la dirección no
 * tiene efecto (o el pedido ya no se puede tocar). */
const ADDRESS_LOCKED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
];

const REFUNDABLE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

const RETRYABLE_LABEL_STATUSES: ShippingLabelStatus[] = [
  ShippingLabelStatus.NEEDS_REVIEW,
  ShippingLabelStatus.FAILED,
];

interface OrderCapabilities {
  nextStatus: OrderStatus | null;
  nextStatusLabel: string | null;
  /** El validador exige `shipment` siempre en `-> shipped`: el botón debe
   * abrir el modal de guía en vez de disparar la llamada directo. */
  requiresShipmentForNextStatus: boolean;
  nextStatusBlockedReason: string | null;

  canCancel: boolean;
  /** No deshabilita cancelar (los 409 de Stripe dependen del proveedor y no
   * son derivables con certeza aquí) — solo avisa. */
  cancelWarning: string | null;

  canEditShipment: boolean;
  editShipmentBlockedReason: string | null;

  canEditAddress: boolean;
  addressBlockedReason: string | null;

  canRetryLabel: boolean;
  retryLabelBlockedReason: string | null;

  remainingRefundCents: number;
  canRefund: boolean;
  refundBlockedReason: string | null;

  canChangePriority: true;
}

/** Deriva de `order` lo que cada botón del detalle puede ofrecer, para no
 * dibujar una acción que el backend va a rechazar con 409. Cuando algo no
 * se puede, la regla de UX es mostrar el motivo, no ocultar el botón —
 * salvo lo estructuralmente inaplicable (`nextStatus === null`, sin `label`). */
function getOrderCapabilities(order: AdminOrder): OrderCapabilities {
  const nextStatus = ADMIN_NEXT_STATUS[order.status] ?? null;
  const disputeOpen = order.disputeStatus === DisputeStatus.OPEN;

  // `shipped -> delivered` NO está bloqueada por contracargo
  // (order-dispute.service.ts) — solo las dos transiciones de despacho.
  const nextStatusBlockedByDispute =
    disputeOpen && (order.status === OrderStatus.PAID || order.status === OrderStatus.PROCESSING);

  const remainingRefundCents = order.totals.totalCents - (order.payment.refundedAmountCents ?? 0);

  const refundLeaseMs = REFUND_REQUEST_LEASE_MINUTES * 60 * 1000;
  const refundInFlight = Boolean(
    order.refundRequestedAt && Date.now() - new Date(order.refundRequestedAt).getTime() < refundLeaseMs,
  );

  const addressBlockedByLabel = Boolean(
    order.label && ADDRESS_LOCKED_LABEL_STATUSES.includes(order.label.status),
  );
  const addressBlockedByStatus = ADDRESS_LOCKED_ORDER_STATUSES.includes(order.status);

  let addressBlockedReason: string | null = null;
  if (addressBlockedByLabel) {
    addressBlockedReason = "La guía ya se generó con la dirección actual.";
  } else if (addressBlockedByStatus) {
    addressBlockedReason = `No se puede corregir la dirección de un pedido ${ORDER_STATUS_LABELS[order.status].toLowerCase()}.`;
  }

  let refundBlockedReason: string | null = null;
  if (!REFUNDABLE_ORDER_STATUSES.includes(order.status)) {
    refundBlockedReason = "Solo se puede reembolsar un pedido pagado, en preparación, enviado o entregado.";
  } else if (order.payment.method === PaymentMethod.OXXO) {
    refundBlockedReason = "Los pagos OXXO no se pueden reembolsar por Stripe.";
  } else if (disputeOpen) {
    refundBlockedReason = "El pedido tiene un contracargo abierto.";
  } else if (remainingRefundCents <= 0) {
    refundBlockedReason = "Este pedido ya fue reembolsado por completo.";
  } else if (refundInFlight) {
    refundBlockedReason = "Ya hay un reembolso en proceso para este pedido.";
  }

  return {
    nextStatus,
    nextStatusLabel: nextStatus ? (NEXT_STATUS_LABEL[order.status] ?? null) : null,
    requiresShipmentForNextStatus: nextStatus === OrderStatus.SHIPPED,
    nextStatusBlockedReason: nextStatusBlockedByDispute ? "El pedido tiene un contracargo abierto." : null,

    canCancel: order.status === OrderStatus.PENDING,
    cancelWarning: order.adminAlertedAt
      ? "Este pedido tiene una revisión de pago pendiente; la cancelación puede rechazarse."
      : null,

    canEditShipment: Boolean(order.shipment),
    editShipmentBlockedReason: order.shipment
      ? null
      : "Este pedido aún no tiene guía; usa \"Marcar como enviada\" para crearla.",

    canEditAddress: !addressBlockedByLabel && !addressBlockedByStatus,
    addressBlockedReason,

    canRetryLabel:
      (order.status === OrderStatus.PAID || order.status === OrderStatus.PROCESSING) &&
      Boolean(order.label && RETRYABLE_LABEL_STATUSES.includes(order.label.status)),
    retryLabelBlockedReason: order.label && RETRYABLE_LABEL_STATUSES.includes(order.label.status)
      ? null
      : "La guía de este pedido no está en un estado que permita reintentar.",

    remainingRefundCents,
    canRefund: !refundBlockedReason,
    refundBlockedReason,

    canChangePriority: true,
  };
}

export type { OrderCapabilities };
export { getOrderCapabilities };
