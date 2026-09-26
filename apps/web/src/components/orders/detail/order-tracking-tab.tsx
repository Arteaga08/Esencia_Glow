import { SHIPMENT_TRACKING_STATUS_LABELS, ShipmentTrackingStatus, type AdminOrderTracking } from "@esencia-glow/shared";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";

interface OrderTrackingTabProps {
  tracking: AdminOrderTracking | null;
  trackingError: string | null;
}

/** Orden cronológico ASCENDENTE (el más viejo primero) — así se lee como el
 * avance real del paquete, no como una bitácora al revés. */
function OrderTrackingTab({ tracking, trackingError }: OrderTrackingTabProps) {
  if (trackingError) return <ErrorState description={trackingError} />;
  if (tracking === null) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const items: TimelineItem[] = [...tracking.events]
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
    .map((event, index) => ({
      id: `${event.providerEventId}-${index}`,
      title: SHIPMENT_TRACKING_STATUS_LABELS[event.status],
      at: event.occurredAt,
      description: event.description,
      meta: event.location,
      tone: event.status === ShipmentTrackingStatus.EXCEPTION ? "danger" : undefined,
    }));

  return <Timeline items={items} emptyMessage="Este pedido todavía no tiene eventos de rastreo." />;
}

export { OrderTrackingTab };
