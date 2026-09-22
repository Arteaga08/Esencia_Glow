/**
 * Estado del rastreo de un envío (Milestone 1.9), independiente del estado de
 * la orden: la paquetería reporta su propio avance y el sistema lo traduce a
 * transiciones de orden (`picked_up` -> `shipped`, `delivered` -> `delivered`).
 *
 * Avance lineal: `label_created < picked_up < in_transit < out_for_delivery <
 * delivered`. `exception` (incidencia: dirección incorrecta, intento fallido)
 * es un estado lateral que puede seguirse de más avance. `delivered` y
 * `returned` son TERMINALES.
 */
enum ShipmentTrackingStatus {
  LABEL_CREATED = "label_created",
  PICKED_UP = "picked_up",
  IN_TRANSIT = "in_transit",
  OUT_FOR_DELIVERY = "out_for_delivery",
  DELIVERED = "delivered",
  EXCEPTION = "exception",
  RETURNED = "returned",
}

export { ShipmentTrackingStatus };
