"use client";

import { useState } from "react";
import { ReservationStatus } from "@esencia-glow/shared";
import { ReservationQueueSection } from "@/components/inventory/reservation-queue-section";

const QUEUES: { status: ReservationStatus; label: string; emptyMessage: string; defaultOpen: boolean }[] = [
  {
    status: ReservationStatus.ACTIVE,
    label: "Activos",
    emptyMessage: "Ningún carrito tiene unidades apartadas ahora.",
    defaultOpen: true,
  },
  {
    status: ReservationStatus.COMMITTED,
    label: "Comprometidos",
    emptyMessage: "Todavía no hay apartados convertidos en venta.",
    defaultOpen: false,
  },
  {
    status: ReservationStatus.RELEASED,
    label: "Liberados",
    emptyMessage: "No hay apartados liberados recientes.",
    defaultOpen: false,
  },
];

/**
 * Apartados: una cola por estado. Solo Activos abre por default porque es la
 * única donde hay algo que hacer (liberar); las otras dos son historial.
 * Las terminales se purgan solas un día después (TTL sobre `purgeAt`), por
 * eso Liberados habla de "recientes".
 */
function ReservationsTab() {
  const [refreshSignal, setRefreshSignal] = useState(0);
  const bumpRefresh = () => setRefreshSignal((value) => value + 1);

  return (
    <div>
      <p className="mb-6 text-body text-muted-foreground-strong">
        Unidades apartadas por carritos en proceso de pago. Liberar devuelve las unidades a disponible.
      </p>
      <div className="flex flex-col gap-4">
        {QUEUES.map((queue) => (
          <ReservationQueueSection
            key={queue.status}
            status={queue.status}
            label={queue.label}
            emptyMessage={queue.emptyMessage}
            defaultOpen={queue.defaultOpen}
            refreshSignal={refreshSignal}
            onChanged={bumpRefresh}
          />
        ))}
      </div>
    </div>
  );
}

export { ReservationsTab };
