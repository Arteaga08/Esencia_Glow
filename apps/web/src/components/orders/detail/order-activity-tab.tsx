import type { AdminOrderStatusHistoryEntry } from "@esencia-glow/shared";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Timeline } from "@/components/ui/timeline";
import { mergeOrderTimeline, type OrderActivityEntry } from "./merge-order-timeline";

interface OrderActivityTabProps {
  statusHistory: AdminOrderStatusHistoryEntry[];
  activity: OrderActivityEntry[] | null;
  activityError: string | null;
}

/** Fusiona `statusHistory` (viene con el pedido) y `/activity` (bitácora
 * completa) en una sola línea de tiempo — ver `mergeOrderTimeline`. */
function OrderActivityTab({ statusHistory, activity, activityError }: OrderActivityTabProps) {
  if (activityError) return <ErrorState description={activityError} />;
  if (activity === null) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const items = mergeOrderTimeline(statusHistory, activity);
  return <Timeline items={items} emptyMessage="Este pedido todavía no tiene movimientos." />;
}

export { OrderActivityTab };
