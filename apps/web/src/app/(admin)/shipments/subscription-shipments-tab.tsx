"use client";

import { useState } from "react";
import { ShipmentQueueDisclosure } from "@/components/shipments/shipment-queue-disclosure";
import { SubscriptionShipmentRow } from "@/components/shipments/subscription-shipment-row";
import {
  useSubscriptionShipmentQueue,
  type SubscriptionShipmentQueue,
} from "@/components/shipments/use-subscription-shipment-queue";

const QUEUES: SubscriptionShipmentQueue[] = ["incidents", "pending", "processing", "shipped", "delivered"];

const QUEUE_LABELS: Record<SubscriptionShipmentQueue, string> = {
  incidents: "Incidencias",
  pending: "Por preparar",
  processing: "En preparación",
  shipped: "Enviadas",
  delivered: "Entregadas",
};

const QUEUE_EMPTY_MESSAGE: Record<SubscriptionShipmentQueue, string> = {
  incidents: "Ninguna caja con edición o inventario incompleto.",
  pending: "Ninguna caja de este ciclo esperando preparación.",
  processing: "Ninguna caja en empaque ahora mismo.",
  shipped: "Ninguna caja en camino todavía.",
  delivered: "Sin entregas de este ciclo todavía.",
};

interface SubscriptionQueueSectionProps {
  queue: SubscriptionShipmentQueue;
  /** Sube en cada cambio de estatus de CUALQUIER cola — moverla de
   * `pending` a `processing` la saca de una cola ya montada y la mete en
   * otra igual de montada; sin esto, la caja desaparece del panel hasta
   * recargar (mismo motivo que `refreshSignal` en Tienda). */
  refreshSignal: number;
  onRowChanged: () => void;
}

function SubscriptionQueueSection({ queue, refreshSignal, onRowChanged }: SubscriptionQueueSectionProps) {
  const { shipments, meta, setPage, loadError, retry } = useSubscriptionShipmentQueue(queue, refreshSignal);

  return (
    <ShipmentQueueDisclosure
      label={QUEUE_LABELS[queue]}
      meta={meta}
      loadError={loadError}
      retry={retry}
      isEmpty={(shipments?.length ?? 0) === 0}
      emptyMessage={QUEUE_EMPTY_MESSAGE[queue]}
      onPageChange={setPage}
      itemLabel={{ singular: "caja", plural: "cajas" }}
    >
      {(shipments ?? []).map((shipment) => (
        <SubscriptionShipmentRow key={shipment.id} shipment={shipment} onChanged={onRowChanged} />
      ))}
    </ShipmentQueueDisclosure>
  );
}

/** Cajas del ciclo de suscripción. Sin buscador: `/admin/subscription-shipments`
 * no acepta `search` (ver `subscription-shipment-panel.service.ts`) — sus
 * filtros son plan/ciclo/estatus/incidencia, no texto libre. Sin cola
 * "Canceladas": la cancelación es manual y rara, no una cola que vigilar a
 * diario (mismo criterio que el mockup aprobado). */
function SubscriptionShipmentsTab() {
  const [refreshSignal, setRefreshSignal] = useState(0);
  const bumpRefresh = () => setRefreshSignal((value) => value + 1);

  return (
    <div className="flex flex-col gap-4">
      {QUEUES.map((queue) => (
        <SubscriptionQueueSection key={queue} queue={queue} refreshSignal={refreshSignal} onRowChanged={bumpRefresh} />
      ))}
    </div>
  );
}

export { SubscriptionShipmentsTab };
