"use client";

import { useState, type ReactNode } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import type { PaginationMeta } from "@esencia-glow/shared";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";

interface ShipmentQueueDisclosureProps {
  label: string;
  meta: PaginationMeta | null;
  loadError: string | null;
  retry: () => void;
  isEmpty: boolean;
  emptyMessage: string;
  onPageChange: (page: number) => void;
  itemLabel: { singular: string; plural: string };
  children: ReactNode;
}

/**
 * Cola colapsable genérica (Propuesta A, elegida por Manuel para calcar la
 * lógica visual de Pedidos): mismo shell que `order-queue-section.tsx`, sin
 * el fetch — cada canal (Tienda/Suscripción) trae su propio hook y decide
 * qué fila renderiza, este componente solo es el contenedor.
 */
function ShipmentQueueDisclosure({
  label,
  meta,
  loadError,
  retry,
  isEmpty,
  emptyMessage,
  onPageChange,
  itemLabel,
  children,
}: ShipmentQueueDisclosureProps) {
  const [collapsed, setCollapsed] = useState(false);

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
            {label}
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
      ) : meta === null ? (
        <div className="flex flex-col gap-2 border-t border-border p-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : isEmpty ? (
        <p className="border-t border-border px-4 py-6 text-center text-body-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <>
          <ul className="border-t border-border">{children}</ul>
          <div className="px-4">
            <Pagination meta={meta} onPageChange={onPageChange} itemLabel={itemLabel} />
          </div>
        </>
      )}
    </div>
  );
}

export { ShipmentQueueDisclosure };
