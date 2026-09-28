"use client";

import { useState } from "react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import type { ReservationStatus } from "@esencia-glow/shared";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { ReservationRow } from "./reservation-row";
import { useReservationQueue } from "./use-reservation-queue";

interface ReservationQueueSectionProps {
  status: ReservationStatus;
  label: string;
  emptyMessage: string;
  defaultOpen: boolean;
  refreshSignal: number;
  onChanged: () => void;
}

/**
 * Cola colapsable de apartados en un estado, mismo shell que
 * `category-inventory-section.tsx` y las colas de Envíos: encabezado con el
 * total, y dentro carga / error / vacío / lista + paginación como estados
 * distintos.
 */
function ReservationQueueSection({
  status,
  label,
  emptyMessage,
  defaultOpen,
  refreshSignal,
  onChanged,
}: ReservationQueueSectionProps) {
  const { reservations, meta, setPage, loadError, retry } = useReservationQueue(status, refreshSignal);
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `reservations-${status}`;

  return (
    <section className="overflow-hidden rounded-lg border border-border" aria-labelledby={`${panelId}-title`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-4 bg-muted/40 px-4 py-3 text-left hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
      >
        <span className="flex items-center gap-2">
          {open ? (
            <CaretDown size={14} className="text-muted-foreground-strong" aria-hidden="true" />
          ) : (
            <CaretRight size={14} className="text-muted-foreground-strong" aria-hidden="true" />
          )}
          <span id={`${panelId}-title`} className="text-subtitle font-medium text-foreground">
            {label}
          </span>
        </span>
        {meta ? (
          <span className="font-mono text-body-sm tabular-nums text-muted-foreground-strong">
            {meta.total} {meta.total === 1 ? "apartado" : "apartados"}
          </span>
        ) : (
          <Skeleton className="h-4 w-20" />
        )}
      </button>

      {!open ? null : (
        <div id={panelId} className="border-t border-border">
          {loadError ? (
            <ErrorState description={loadError} onRetry={retry} />
          ) : meta === null || reservations === null ? (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : reservations.length === 0 ? (
            <p className="px-4 py-6 text-center text-body-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <>
              <ul>
                {reservations.map((reservation) => (
                  <ReservationRow key={reservation.id} reservation={reservation} onChanged={onChanged} />
                ))}
              </ul>
              <div className="px-4">
                <Pagination
                  meta={meta}
                  onPageChange={setPage}
                  itemLabel={{ singular: "apartado", plural: "apartados" }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export { ReservationQueueSection };
