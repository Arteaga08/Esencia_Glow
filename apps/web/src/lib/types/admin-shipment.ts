import type {
  AdminOrderCustomer,
  OrderPriority,
  OrderStatus,
  ShipmentTrackingStatus,
  ShippingCarrier,
  ShippingLabelStatus,
} from "@esencia-glow/shared";

/**
 * Espejo manual del DTO que arma `apps/api/src/services/shipment-dto.ts`
 * (`AdminShipmentRow`) — igual que `admin-catalog.ts`: no deriva de un
 * `Public*` de `@esencia-glow/shared`, así que no hay paquete compartido
 * para esta forma. Mantener sincronizado a mano cuando el DTO cambie del
 * lado de la API.
 */
interface AdminShipmentRow {
  id: string;
  orderNumber: string;
  orderStatus: OrderStatus;
  priority: OrderPriority;
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

export type { AdminShipmentRow };
