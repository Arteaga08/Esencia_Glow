"use client";

import Link from "next/link";
import { PencilSimple } from "@phosphor-icons/react";
import { EditionStatus } from "@esencia-glow/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { EditionStatusBadge } from "@/components/subscription-editions/edition-status-badge";
import {
  sortByCycleDesc,
  useSubscriptionEditions,
} from "@/components/subscription-editions/use-subscription-editions";
import { currentCycle, formatCycle, nextCycle } from "@/lib/format-cycle";
import type { AdminSubscriptionEdition, AdminSubscriptionPlan } from "@/lib/types/admin-subscription";

interface PlanMonthlyBoxesProps {
  plan: AdminSubscriptionPlan;
}

interface CycleSlot {
  cycleYear: number;
  cycleMonth: number;
  edition: AdminSubscriptionEdition | null;
}

/** Lápiz de fila: misma acción que el botón, pero visible sin adivinar. */
function EditBoxLink({ edition }: { edition: AdminSubscriptionEdition }) {
  return (
    <Link
      href={`/subscriptions/editions/${edition.id}`}
      aria-label={`Editar ${edition.title}`}
      className="cursor-pointer rounded-sm p-1.5 text-muted-foreground-strong hover:bg-muted hover:text-foreground"
    >
      <PencilSimple size={16} aria-hidden="true" />
    </Link>
  );
}

function productsLabel(count: number): string {
  if (count === 0) return "Sin productos todavía";
  return count === 1 ? "1 producto" : `${count} productos`;
}

/**
 * "Cajas por mes" del plan (2.7c): la edición de cada ciclo vive dentro del
 * plan al que pertenece. El mes en curso y el siguiente salen SIEMPRE, con o
 * sin caja armada — el backend cobra contra la edición publicada de ese mes,
 * así que un hueco ahí es lo que hay que ver de un vistazo. Debajo, el
 * historial de meses anteriores.
 */
function PlanMonthlyBoxes({ plan }: PlanMonthlyBoxesProps) {
  const { editions, loadError, retry } = useSubscriptionEditions({
    planId: plan.id,
    status: null,
    cycleYear: null,
  });

  if (loadError) return <ErrorState description={loadError} onRetry={retry} />;

  const now = currentCycle();
  const next = nextCycle(now.cycleYear, now.cycleMonth);
  const sorted = editions ? sortByCycleDesc(editions) : [];
  const findEdition = (cycleYear: number, cycleMonth: number) =>
    sorted.find((edition) => edition.cycleYear === cycleYear && edition.cycleMonth === cycleMonth) ??
    null;

  const upcoming: CycleSlot[] = [next, now].map((cycle) => ({
    ...cycle,
    edition: findEdition(cycle.cycleYear, cycle.cycleMonth),
  }));
  const isUpcoming = (edition: AdminSubscriptionEdition) =>
    upcoming.some(
      (slot) => slot.cycleYear === edition.cycleYear && slot.cycleMonth === edition.cycleMonth,
    );
  // Las futuras (más allá del mes siguiente) y las pasadas, sin repetir las dos de arriba.
  const others = sorted.filter((edition) => !isUpcoming(edition));

  return (
    <Card>
      <p className="mb-2 text-section-title text-foreground">Cajas por mes</p>
      <p className="mb-6 text-body-sm text-muted-foreground-strong">
        Lo que lleva la caja de {plan.name} cada mes. Publícala antes del cobro: a quien se le cobre
        sin una caja publicada se le avisa como incidencia.
      </p>

      {editions === null ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {upcoming.map((slot) => (
            <li
              key={`${slot.cycleYear}-${slot.cycleMonth}`}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="flex flex-col gap-1">
                <p className="text-body text-foreground">
                  {formatCycle(slot.cycleYear, slot.cycleMonth)}
                  {slot.cycleYear === next.cycleYear && slot.cycleMonth === next.cycleMonth
                    ? " · próximo mes"
                    : " · este mes"}
                </p>
                {slot.edition ? (
                  <p className="text-body-sm text-muted-foreground-strong">
                    {productsLabel(slot.edition.items.length)}
                  </p>
                ) : (
                  <p className="text-body-sm text-destructive-action">Sin caja armada</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {slot.edition ? <EditionStatusBadge status={slot.edition.status} /> : null}
                {slot.edition ? <EditBoxLink edition={slot.edition} /> : null}
                {slot.edition ? (
                  <Link href={`/subscriptions/editions/${slot.edition.id}`}>
                    <Button type="button" variant="secondary" size="sm">
                      {slot.edition.status === EditionStatus.PUBLISHED
                        ? "Ver caja"
                        : "Terminar y publicar"}
                    </Button>
                  </Link>
                ) : plan.isActive ? (
                  <Link
                    href={`/subscriptions/editions/new?planId=${plan.id}&cycleYear=${slot.cycleYear}&cycleMonth=${slot.cycleMonth}`}
                  >
                    <Button type="button" size="sm">
                      Armar caja de {formatCycle(slot.cycleYear, slot.cycleMonth)}
                    </Button>
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
          {others.map((edition) => (
            <li
              key={edition.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="flex flex-col gap-1">
                <p className="text-body text-foreground">
                  {formatCycle(edition.cycleYear, edition.cycleMonth)}
                </p>
                <p className="text-body-sm text-muted-foreground-strong">
                  {productsLabel(edition.items.length)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <EditionStatusBadge status={edition.status} />
                <EditBoxLink edition={edition} />
                <Link href={`/subscriptions/editions/${edition.id}`}>
                  <Button type="button" variant="ghost" size="sm">
                    Abrir
                  </Button>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export { PlanMonthlyBoxes };
