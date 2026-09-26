import { useCallback, useEffect, useState } from "react";
import { SubscriptionShipmentStatus, type PaginationMeta } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";
import type { AdminSubscriptionShipment } from "@/lib/types/admin-subscription";

const SECTION_PAGE_LIMIT = 10;

/** Las 5 colas de la pestaña Suscripción — ver el plan del Milestone 2.4.
 * `canceled` no tiene cola propia (decisión de esta sesión, igual que en el
 * mockup aprobado): la cancelación es manual y rara, no una cola de
 * trabajo que alguien vigile a diario. */
type SubscriptionShipmentQueue = "incidents" | "pending" | "processing" | "shipped" | "delivered";

/**
 * `/admin/subscription-shipments` no tiene noción de "cola": este mapa
 * arma la combinación `status`+`incident` que hace disjunta cada cola —
 * las 4 colas de estatus EXCLUYEN incidencia explícitamente (`incident:
 * false`), igual que `NOT_PROBLEM` del lado de Tienda, para que una caja
 * con incidencia no aparezca dos veces. Ese listado tampoco acepta
 * `search` (`subscription-shipment-panel.service.ts`), así que esta pestaña
 * no lleva buscador.
 */
function paramsForQueue(queue: SubscriptionShipmentQueue): { status?: SubscriptionShipmentStatus; incident?: boolean } {
  // LIMITACIÓN CONOCIDA (hallazgo de /code-review, deferido — cruza a
  // 1.7.2b/1.7.3, fuera del alcance de solo-lectura+acciones de esta
  // sesión): nada en `subscription-shipment.service.ts` limpia
  // `editionIncident`/`inventoryIncident` tras crearse, así que una caja ya
  // enviada o entregada con incidencia se queda en esta cola para siempre.
  // El endpoint no soporta excluir estatus (un solo `status`, no `$nin`), y
  // ampliar ese contrato es una decisión de Manuel, no de esta sesión.
  if (queue === "incidents") return { incident: true };
  const status: Record<Exclude<SubscriptionShipmentQueue, "incidents">, SubscriptionShipmentStatus> = {
    pending: SubscriptionShipmentStatus.PENDING,
    processing: SubscriptionShipmentStatus.PROCESSING,
    shipped: SubscriptionShipmentStatus.SHIPPED,
    delivered: SubscriptionShipmentStatus.DELIVERED,
  };
  return { status: status[queue], incident: false };
}

/**
 * `refreshSignal` (ver `use-shipment-queue.ts` del lado de Tienda, mismo
 * motivo): cambiar el estatus de una caja la mueve de cola, y sin esto la
 * cola destino —ya montada— nunca se entera. Lo emite la pestaña
 * (`subscription-shipments-tab.tsx`), compartido por las 5 colas.
 */
function useSubscriptionShipmentQueue(queue: SubscriptionShipmentQueue, refreshSignal = 0) {
  const [page, setPage] = useState(1);
  const [shipments, setShipments] = useState<AdminSubscriptionShipment[] | null>(null);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const fetchPage = useCallback(() => {
    return apiRequest<AdminSubscriptionShipment[], PaginationMeta>("/api/v1/admin/subscription-shipments", {
      authenticated: true,
      query: { ...paramsForQueue(queue), page, limit: SECTION_PAGE_LIMIT },
    });
  }, [queue, page]);

  useEffect(() => {
    let cancelled = false;
    fetchPage()
      .then((response) => {
        if (cancelled) return;
        if (response.data.length === 0 && page > 1) {
          setPage(1);
          return;
        }
        setShipments(response.data);
        setMeta(response.meta ?? null);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar estas cajas.");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage, retryKey, page, refreshSignal]);

  const retry = useCallback(() => setRetryKey((key) => key + 1), []);

  return { shipments, meta, page, setPage, loadError, retry };
}

export { useSubscriptionShipmentQueue };
export type { SubscriptionShipmentQueue };
