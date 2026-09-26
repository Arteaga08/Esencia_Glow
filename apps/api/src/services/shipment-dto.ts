import type { Types } from "mongoose";
import type {
  AdminOrderCustomer,
  OrderPriority,
  OrderStatus,
  ShipmentTrackingStatus,
  ShippingCarrier,
  ShippingLabelStatus,
} from "@esencia-glow/shared";
import type { OrderAttrs } from "../models/order.model.js";

/**
 * DTO admin de `/admin/shipments` (Milestone 2.4) — proyección de `Order`
 * pensada para el panel de envíos, no el `AdminOrder` completo que arma
 * `order-dto.ts` (ese sigue siendo la fuente de `/orders/:id`). Vive solo en
 * la API, con espejo manual del lado de `apps/web`: mismo precedente que
 * `AdminProduct`/`AdminSubscriptionShipment` (no deriva de un `Public*` de
 * `@esencia-glow/shared`, así que no hay razón para vivir ahí — ver el
 * comentario de cabecera de `subscription-dto.ts`).
 */
interface LeanOrderForShipment {
  _id: Types.ObjectId;
  orderNumber: string;
  userId: Types.ObjectId;
  status: OrderStatus;
  priority: OrderPriority;
  shippingAddress: { fullName: string; city: string; state: string };
  label?: OrderAttrs["label"];
  tracking?: OrderAttrs["tracking"];
  shipment?: OrderAttrs["shipment"];
  createdAt: Date;
}

interface AdminShipmentRow {
  id: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  priority: OrderPriority;
  /** `null` si el usuario fue borrado — mismo criterio que `AdminOrder`. El
   * nombre de respaldo (`fallbackName`) es el de la dirección congelada, el
   * mismo que ya usa `order-row.tsx` cuando `customer` falta. */
  customer: AdminOrderCustomer | null;
  fallbackName: string;
  destinationCity: string;
  destinationState: string;
  labelStatus?: ShippingLabelStatus;
  labelAttempts: number;
  labelUrl?: string;
  labelLastError?: string;
  labelNextAttemptAt?: string;
  carrier?: ShippingCarrier;
  trackingNumber?: string;
  trackingUrl?: string;
  trackingStatus?: ShipmentTrackingStatus;
  trackingLastEventAt?: string;
  shippedAt?: string;
  createdAt: string;
}

/**
 * `carrier`/`trackingNumber`/`trackingUrl` prefieren `shipment` (el envío ya
 * despachado, con guía confirmada) y caen a `label` (la guía comprada, antes
 * de que el rastreo confirme el primer evento) — igual de cierto en
 * `preparing`/`transit` que en `problems`, donde puede no haber `shipment`
 * todavía. `label.requestedAt` (token de fencing interno) nunca cruza,
 * mismo criterio que `AdminOrderLabel` en `order-dto.ts`.
 */
function buildAdminShipmentRow(order: LeanOrderForShipment, customer: AdminOrderCustomer | null): AdminShipmentRow {
  const carrier = order.shipment?.carrier ?? order.label?.carrier;
  const trackingNumber = order.shipment?.trackingNumber ?? order.label?.trackingNumber;
  const trackingUrl = order.shipment?.trackingUrl ?? order.label?.trackingUrl;

  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    priority: order.priority,
    customer,
    fallbackName: order.shippingAddress.fullName,
    destinationCity: order.shippingAddress.city,
    destinationState: order.shippingAddress.state,
    ...(order.label ? { labelStatus: order.label.status } : {}),
    labelAttempts: order.label?.attempts ?? 0,
    ...(order.label?.labelUrl ? { labelUrl: order.label.labelUrl } : {}),
    ...(order.label?.lastError ? { labelLastError: order.label.lastError } : {}),
    ...(order.label?.nextAttemptAt ? { labelNextAttemptAt: order.label.nextAttemptAt.toISOString() } : {}),
    ...(carrier ? { carrier } : {}),
    ...(trackingNumber ? { trackingNumber } : {}),
    ...(trackingUrl ? { trackingUrl } : {}),
    ...(order.tracking
      ? { trackingStatus: order.tracking.status, trackingLastEventAt: order.tracking.lastEventAt.toISOString() }
      : {}),
    ...(order.shipment?.shippedAt ? { shippedAt: order.shipment.shippedAt.toISOString() } : {}),
    createdAt: order.createdAt.toISOString(),
  };
}

export { buildAdminShipmentRow };
export type { AdminShipmentRow, LeanOrderForShipment };
