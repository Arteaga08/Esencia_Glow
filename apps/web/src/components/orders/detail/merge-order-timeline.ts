import {
  ORDER_ACTION_LABELS,
  ORDER_STATUS_LABELS,
  OrderAction,
  type AdminOrderStatusHistoryEntry,
} from "@esencia-glow/shared";
import type { TimelineItem } from "@/components/ui/timeline";

/** `GET /:id/activity` — no viene de `@esencia-glow/shared` porque es un
 * DTO propio del endpoint, sin tipo compartido (ver `order-admin.service.ts`). */
interface OrderActivityEntry {
  action: string;
  actorId?: string;
  at: string;
}

/** Un cambio de estatus y su entrada de audit correspondiente ocurren en la
 * misma transacción — se consideran "el mismo evento" dentro de esta
 * ventana. */
const DEDUPE_WINDOW_MS = 2000;

/** Acciones de audit que `statusHistory` ya representa con más detalle
 * (razón, tipo de actor) — se descartan si hay una entrada de `statusHistory`
 * a menos de `DEDUPE_WINDOW_MS` de distancia. */
const STATUS_CHANGE_ACTIONS: string[] = [
  OrderAction.ORDER_STATUS_CHANGED,
  OrderAction.ORDER_PAID,
  OrderAction.ORDER_CANCELLED,
];

function actorLabelFor(entry: AdminOrderStatusHistoryEntry): string {
  // `actorType` distingue "user" (admin o clienta) de "system" (webhook,
  // job) — no distingue rol dentro de "user", así que no se inventa
  // "Admin" cuando podría ser la clienta cancelando su propio pedido.
  return entry.actorType === "system" ? "Sistema" : "Persona";
}

/**
 * Fusiona `order.statusHistory` con `/activity` en una sola línea de tiempo
 * descendente, sin duplicar el mismo cambio de estatus dos veces.
 */
function mergeOrderTimeline(
  statusHistory: AdminOrderStatusHistoryEntry[],
  activity: OrderActivityEntry[],
): TimelineItem[] {
  const consumedActivityIndexes = new Set<number>();

  const statusItems: TimelineItem[] = statusHistory.map((entry, index) => {
    const entryTime = new Date(entry.at).getTime();
    const matchIndex = activity.findIndex(
      (a, i) =>
        !consumedActivityIndexes.has(i) &&
        STATUS_CHANGE_ACTIONS.includes(a.action) &&
        Math.abs(new Date(a.at).getTime() - entryTime) <= DEDUPE_WINDOW_MS,
    );
    if (matchIndex >= 0) consumedActivityIndexes.add(matchIndex);

    return {
      id: `status-${index}-${entry.at}`,
      title: ORDER_STATUS_LABELS[entry.status],
      at: entry.at,
      description: entry.reason,
      meta: actorLabelFor(entry),
    };
  });

  const activityItems: TimelineItem[] = activity
    .map((entry, index) => ({ entry, index }))
    .filter(({ index }) => !consumedActivityIndexes.has(index))
    .map(({ entry, index }) => ({
      id: `activity-${index}-${entry.at}`,
      title: ORDER_ACTION_LABELS[entry.action as OrderAction] ?? entry.action,
      at: entry.at,
      meta: entry.actorId ? "Admin" : "Sistema",
    }));

  return [...statusItems, ...activityItems].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

export { mergeOrderTimeline };
export type { OrderActivityEntry };
