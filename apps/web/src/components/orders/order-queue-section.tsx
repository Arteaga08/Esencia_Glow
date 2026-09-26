"use client";

import { useState } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import type { OrderStatusGroup } from "@esencia-glow/shared";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderRow } from "./order-row";
import { useOrderGroup, type OrderGroupFilters } from "./use-order-group";

const GROUP_LABELS: Record<OrderStatusGroup, string> = {
  action: "Pendientes",
  progress: "Pagos",
  shipping: "Envíos",
  problems: "Problemas",
};

const GROUP_EMPTY_MESSAGE: Record<OrderStatusGroup, string> = {
  action: "Ningún pedido esperando pago o confirmación.",
  progress: "Ningún pedido cobrado en preparación ahora mismo.",
  shipping: "Ningún pedido en camino o entregado todavía.",
  problems: "Sin cancelaciones ni reembolsos.",
};

interface OrderQueueSectionProps {
  group: OrderStatusGroup;
  filters: OrderGroupFilters;
  isFiltered: boolean;
}

/**
 * Una cola de trabajo colapsable (Propuesta B, elegida por Manuel). El
 * conteo del encabezado es el `meta.total` de la propia sección — se
 * calcula aunque esté colapsada, para que el número nunca desaparezca al
 * cerrarla.
 */
function OrderQueueSection({ group, filters, isFiltered }: OrderQueueSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { orders, meta, setPage, loadError, retry } = useOrderGroup(group, filters);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        aria-expanded={!collapsed}
        className="flex w-full cursor-pointer items-center justify-between bg-muted/40 px-4 py-3 text-left hover:bg-muted/60"
      >
        <span className="flex items-center gap-2">
          {collapsed ? (
            <CaretRight size={14} className="text-muted-foreground-strong" aria-hidden="true" />
          ) : (
            <CaretDown size={14} className="text-muted-foreground-strong" aria-hidden="true" />
          )}
          <span className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
            {GROUP_LABELS[group]}
          </span>
        </span>
        {meta ? (
          <span className="font-mono text-body-sm tabular-nums text-foreground">{meta.total}</span>
        ) : (
          <Skeleton className="h-4 w-6" />
        )}
      </button>

      {collapsed ? null : loadError ? (
        <div className="border-t border-border">
          <ErrorState description={loadError} onRetry={retry} />
        </div>
      ) : orders === null ? (
        <div className="flex flex-col gap-2 border-t border-border p-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="border-t border-border px-4 py-6 text-center text-body-sm text-muted-foreground">
          {isFiltered ? "Ningún pedido de esta cola coincide con el filtro." : GROUP_EMPTY_MESSAGE[group]}
        </p>
      ) : (
        <>
          <ul>
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </ul>
          {meta ? (
            <div className="px-4">
              <Pagination meta={meta} onPageChange={setPage} itemLabel={{ singular: "pedido", plural: "pedidos" }} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export { OrderQueueSection };
