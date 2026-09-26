"use client";

import { useEffect, useState } from "react";
import type { ShipmentQueue } from "@esencia-glow/shared";
import { Input } from "@/components/ui/input";
import { ShipmentQueueDisclosure } from "@/components/shipments/shipment-queue-disclosure";
import { StoreShipmentRow } from "@/components/shipments/store-shipment-row";
import { useShipmentQueue } from "@/components/shipments/use-shipment-queue";

const SEARCH_DEBOUNCE_MS = 300;

const QUEUES: ShipmentQueue[] = ["problems", "preparing", "transit", "delivered"];

const QUEUE_LABELS: Record<ShipmentQueue, string> = {
  problems: "Requieren atención",
  preparing: "Por despachar",
  transit: "En camino",
  delivered: "Entregadas",
};

const QUEUE_EMPTY_MESSAGE: Record<ShipmentQueue, string> = {
  problems: "Ninguna guía atorada ni paquete con incidencia.",
  preparing: "Ningún pedido pagado esperando guía.",
  transit: "Ningún paquete en tránsito ahora mismo.",
  delivered: "Sin entregas todavía.",
};

interface StoreQueueSectionProps {
  queue: ShipmentQueue;
  search: string;
  isFiltered: boolean;
  /** Sube en cada acción de CUALQUIER cola de esta pestaña — ver
   * `use-shipment-queue.ts`: reintentar una guía puede sacar un pedido de
   * `problems` y meterlo en `preparing`, y esa segunda cola ya está
   * montada, así que necesita enterarse aunque la acción no haya ocurrido
   * en ella. */
  refreshSignal: number;
  onRowRetried: () => void;
}

function StoreQueueSection({ queue, search, isFiltered, refreshSignal, onRowRetried }: StoreQueueSectionProps) {
  const { shipments, meta, setPage, loadError, retry } = useShipmentQueue(queue, { search }, refreshSignal);

  return (
    <ShipmentQueueDisclosure
      label={QUEUE_LABELS[queue]}
      meta={meta}
      loadError={loadError}
      retry={retry}
      isEmpty={(shipments?.length ?? 0) === 0}
      emptyMessage={isFiltered ? "Ningún envío de esta cola coincide con la búsqueda." : QUEUE_EMPTY_MESSAGE[queue]}
      onPageChange={setPage}
      itemLabel={{ singular: "envío", plural: "envíos" }}
    >
      {(shipments ?? []).map((shipment) => (
        <StoreShipmentRow key={shipment.id} shipment={shipment} onRetried={onRowRetried} />
      ))}
    </ShipmentQueueDisclosure>
  );
}

/** Envíos de compras de tienda (producto y paquetes) — las cajas de
 * suscripción son otro modelo y viven en la pestaña Suscripción de esta
 * misma pantalla. Propuesta A elegida por Manuel: misma lógica visual que
 * Pedidos (2.3), cuatro colas apiladas y colapsables. */
function StoreShipmentsTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [refreshSignal, setRefreshSignal] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  const isFiltered = Boolean(debouncedSearch);
  const bumpRefresh = () => setRefreshSignal((value) => value + 1);

  return (
    <div>
      <div className="mb-6 w-80">
        <Input
          label="Buscar"
          placeholder="Busca por pedido, guía, nombre o correo"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-4">
        {QUEUES.map((queue) => (
          <StoreQueueSection
            key={queue}
            queue={queue}
            search={debouncedSearch}
            isFiltered={isFiltered}
            refreshSignal={refreshSignal}
            onRowRetried={bumpRefresh}
          />
        ))}
      </div>
    </div>
  );
}

export { StoreShipmentsTab };
