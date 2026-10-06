import { OrderStatus } from "@esencia-glow/shared";
import { sendOrderProcessingEmail, sendShipmentNotificationEmail } from "./order-email.service.js";

/**
 * Qué correo al cliente dispara cada transición de estado aplicada de verdad
 * (Milestone 3.6): `processing` avisa que se prepara el pedido y `shipped`
 * manda la guía. Un solo punto para que el camino del sistema (guía lista,
 * rastreo) y el del admin (panel, lote) no dupliquen el `if`. Los demás
 * estados ya tienen su propio correo (pago, reembolso) o no avisan.
 *
 * Fire-and-forget por diseño: se llama FUERA de la transacción y un correo
 * nunca revierte la transición (los envíos de `order-email.service.ts` ya
 * absorben cualquier error). Corregir la guía en sitio (`updateOrderShipment`)
 * no pasa por aquí, así que no reenvía el correo de guía.
 */
function notifyOrderStatusEmail(orderId: string, to: OrderStatus): void {
  if (to === OrderStatus.PROCESSING) void sendOrderProcessingEmail(orderId);
  else if (to === OrderStatus.SHIPPED) void sendShipmentNotificationEmail(orderId);
}

export { notifyOrderStatusEmail };
