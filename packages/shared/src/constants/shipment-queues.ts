/**
 * Colas de trabajo de `/admin/shipments` (Milestone 2.4) — solo envíos de
 * TIENDA (`Order`). A diferencia de `ORDER_STATUS_TO_GROUP`, la cola no se
 * deriva de un único campo enum: depende de `status` + `label.status` +
 * `tracking.status` a la vez, así que aquí solo viven los ids (para que el
 * validador de la API y el hook del panel compartan la misma lista) — el
 * mapeo a filtro de Mongo vive en `shipment-panel.service.ts`, del lado de
 * la API.
 */
type ShipmentQueue = "problems" | "preparing" | "transit" | "delivered";

const SHIPMENT_QUEUES: ShipmentQueue[] = ["problems", "preparing", "transit", "delivered"];

export { SHIPMENT_QUEUES };
export type { ShipmentQueue };
