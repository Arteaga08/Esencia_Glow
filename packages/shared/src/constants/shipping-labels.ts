import { ShippingCarrier } from "../enums/shipping-carrier.js";
import { ShippingLabelStatus } from "../enums/shipping-label-status.js";
import { ShipmentTrackingStatus } from "../enums/shipment-tracking-status.js";

/**
 * Etiquetas en español del ciclo de vida de la guía de envío. `Record`
 * exhaustivo: agregar un estado a `ShippingLabelStatus` sin etiquetarlo
 * aquí rompe el typecheck. No confundir con `shipping.ts` (constantes
 * numéricas de política de envío) — este archivo es solo texto para UI.
 */
const SHIPPING_LABEL_STATUS_LABELS: Record<ShippingLabelStatus, string> = {
  [ShippingLabelStatus.PENDING]: "En cola",
  [ShippingLabelStatus.REQUESTED]: "Solicitando",
  [ShippingLabelStatus.PROCESSING]: "Generando",
  [ShippingLabelStatus.READY]: "Lista",
  [ShippingLabelStatus.FAILED]: "Rechazada",
  [ShippingLabelStatus.NEEDS_REVIEW]: "En revisión",
};

/** Etiquetas en español del rastreo reportado por la paquetería. */
const SHIPMENT_TRACKING_STATUS_LABELS: Record<ShipmentTrackingStatus, string> = {
  [ShipmentTrackingStatus.LABEL_CREATED]: "Guía creada",
  [ShipmentTrackingStatus.PICKED_UP]: "Recolectado",
  [ShipmentTrackingStatus.IN_TRANSIT]: "En tránsito",
  [ShipmentTrackingStatus.OUT_FOR_DELIVERY]: "En reparto",
  [ShipmentTrackingStatus.DELIVERED]: "Entregado",
  [ShipmentTrackingStatus.EXCEPTION]: "Incidencia",
  [ShipmentTrackingStatus.RETURNED]: "Devuelto",
};

/** Etiquetas en español de las paqueterías soportadas. */
const SHIPPING_CARRIER_LABELS: Record<ShippingCarrier, string> = {
  [ShippingCarrier.ESTAFETA]: "Estafeta",
  [ShippingCarrier.FEDEX]: "FedEx",
  [ShippingCarrier.DHL]: "DHL",
  [ShippingCarrier.PAQUETEEXPRESS]: "Paquete Express",
  [ShippingCarrier.REDPACK]: "Redpack",
};

export { SHIPPING_LABEL_STATUS_LABELS, SHIPMENT_TRACKING_STATUS_LABELS, SHIPPING_CARRIER_LABELS };
