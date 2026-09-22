import type {
  AdminOrderTracking,
  PublicOrderTracking,
  ShipmentTrackingStatus,
  ShippingCarrier,
} from "@esencia-glow/shared";
import { Order } from "../models/order.model.js";
import { ShipmentTrackingEvent } from "../models/shipment-tracking-event.model.js";
import { AppError } from "../utils/app-error.js";

/**
 * Lectura del rastreo de una orden (Milestone 1.9): estado agregado, guía y
 * bitácora de eventos ordenada por `occurredAt`. La clienta lo lee con el
 * anti-IDOR de siempre (`{_id, userId}` dentro del filtro, un pedido ajeno es
 * 404 — jamás confirma que existe); el admin lo lee sin ese filtro y además
 * ve el origen de cada evento para conciliarlo con el panel del proveedor.
 */

/** Techo de eventos devueltos: una bitácora sin acotar es un DoS contra sí misma. */
const MAX_TRACKING_EVENTS = 200;

interface TrackedOrderSnapshot {
  _id: unknown;
  tracking?: { status: ShipmentTrackingStatus };
  shipment?: { carrier: ShippingCarrier; trackingNumber: string; trackingUrl?: string };
  label?: { trackingNumber?: string; carrier?: ShippingCarrier; trackingUrl?: string };
}

/** La guía sale del envío ya despachado; antes de eso, de la etiqueta ya
 * generada (el número existe desde que se compra la guía). */
function pickCarrierInfo(order: TrackedOrderSnapshot) {
  const source = order.shipment ?? (order.label?.trackingNumber && order.label.carrier ? order.label : undefined);
  if (!source?.trackingNumber || !source.carrier) return {};
  return {
    carrier: source.carrier,
    trackingNumber: source.trackingNumber,
    ...(source.trackingUrl ? { trackingUrl: source.trackingUrl } : {}),
  };
}

/** Se conservan los MÁS RECIENTES (el estado vigente y la entrega son lo que
 * importa) y se devuelven en orden cronológico ascendente. */
async function loadEvents(orderId: unknown) {
  const newest = await ShipmentTrackingEvent.find({ orderId })
    .sort({ occurredAt: -1, _id: -1 })
    .limit(MAX_TRACKING_EVENTS)
    .lean();
  return newest.reverse();
}

async function loadOrder(filter: Record<string, unknown>): Promise<TrackedOrderSnapshot> {
  const order = await Order.findOne(filter).select("tracking shipment label").lean<TrackedOrderSnapshot>();
  if (!order) throw new AppError("Pedido no encontrado.", 404);
  return order;
}

async function getMyOrderTracking(orderId: string, userId: string): Promise<PublicOrderTracking> {
  // Anti-IDOR: la propiedad viaja DENTRO del filtro, nunca un check posterior.
  const order = await loadOrder({ _id: orderId, userId });
  const events = await loadEvents(order._id);
  return {
    ...(order.tracking ? { status: order.tracking.status } : {}),
    ...pickCarrierInfo(order),
    events: events.map((event) => ({
      status: event.status,
      occurredAt: event.occurredAt.toISOString(),
      ...(event.description ? { description: event.description } : {}),
      ...(event.location ? { location: event.location } : {}),
    })),
  };
}

async function getAdminOrderTracking(orderId: string): Promise<AdminOrderTracking> {
  const order = await loadOrder({ _id: orderId });
  const events = await loadEvents(order._id);
  return {
    ...(order.tracking ? { status: order.tracking.status } : {}),
    ...pickCarrierInfo(order),
    events: events.map((event) => ({
      status: event.status,
      occurredAt: event.occurredAt.toISOString(),
      ...(event.description ? { description: event.description } : {}),
      ...(event.location ? { location: event.location } : {}),
      provider: event.provider,
      providerEventId: event.providerEventId,
    })),
  };
}

export { getMyOrderTracking, getAdminOrderTracking, MAX_TRACKING_EVENTS };
