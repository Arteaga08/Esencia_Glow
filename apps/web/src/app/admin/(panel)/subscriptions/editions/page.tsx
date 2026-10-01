"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarBlank, PencilSimple, Plus } from "@phosphor-icons/react";
import { EditionStatus } from "@esencia-glow/shared";
import { getButtonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, type TableColumn } from "@/components/ui/table";
import { EditionStatusBadge } from "@/components/subscription-editions/edition-status-badge";
import {
  sortByCycleDesc,
  useSubscriptionEditions,
} from "@/components/subscription-editions/use-subscription-editions";
import { useSubscriptionPlans } from "@/components/subscription-plans/use-subscription-plans";
import { formatCycle } from "@/lib/format-cycle";
import { formatShortDate } from "@/lib/format-date";
import type { AdminSubscriptionEdition } from "@/lib/types/admin-subscription";
import { ADMIN_ROUTES } from "@/lib/admin-routes";

/** Mismo rango que acepta el backend (subscription-query.validator.ts): un
 * año fuera de él nunca se manda, o la lista entera caería en error. */
const MIN_CYCLE_YEAR = 2024;
const MAX_CYCLE_YEAR = 2100;

const STATUS_OPTIONS = [
  { value: EditionStatus.DRAFT, label: "Borrador" },
  { value: EditionStatus.PUBLISHED, label: "Publicada" },
];

/**
 * Milestone 2.7b-2 — Ediciones de suscripción: tabla filtrable (plan,
 * estado, año), Propuesta A elegida por Manuel de tres presentadas en
 * `/subscriptions/editions/preview` (borrado tras la elección). Cada edición
 * se arma en su propia pantalla, a lo ancho, igual que Planes.
 */
export default function SubscriptionEditionsPage() {
  const { plans } = useSubscriptionPlans();
  const [planId, setPlanId] = useState<string | null>(null);
  const [status, setStatus] = useState<EditionStatus | null>(null);
  const [year, setYear] = useState("");
  const typedYear = /^\d{4}$/.test(year) ? Number(year) : null;
  const yearOutOfRange =
    typedYear !== null && (typedYear < MIN_CYCLE_YEAR || typedYear > MAX_CYCLE_YEAR);
  const cycleYear = yearOutOfRange ? null : typedYear;
  const { editions, loadError, retry } = useSubscriptionEditions({ planId, status, cycleYear });

  const plansById = useMemo(() => new Map((plans ?? []).map((plan) => [plan.id, plan])), [plans]);
  const rows = editions ? sortByCycleDesc(editions) : null;
  const isFiltered = Boolean(planId || status || cycleYear);

  const columns: TableColumn<AdminSubscriptionEdition>[] = [
    {
      header: "Ciclo",
      render: (edition) => (
        <span className="font-mono text-data tabular-nums">
          {formatCycle(edition.cycleYear, edition.cycleMonth)}
        </span>
      ),
    },
    { header: "Plan", render: (edition) => plansById.get(edition.planId)?.name ?? "—" },
    {
      header: "Título",
      render: (edition) => (
        <Link
          href={ADMIN_ROUTES.edition(edition.id)}
          className="text-body text-foreground hover:underline focus-visible:underline"
        >
          {edition.title}
        </Link>
      ),
    },
    { header: "Productos", align: "right", render: (edition) => edition.items.length },
    { header: "Estado", render: (edition) => <EditionStatusBadge status={edition.status} /> },
    {
      header: "Publicada",
      align: "right",
      render: (edition) => (edition.publishedAt ? formatShortDate(edition.publishedAt) : "—"),
    },
    {
      header: "Acciones",
      align: "right",
      render: (edition) => (
        <div className="flex justify-end gap-1">
          <Link
            href={ADMIN_ROUTES.edition(edition.id)}
            aria-label={`Editar ${edition.title}`}
            className="cursor-pointer rounded-sm p-1.5 text-muted-foreground-strong hover:bg-muted hover:text-foreground"
          >
            <PencilSimple size={16} aria-hidden="true" />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <Select
              label="Plan"
              value={planId}
              onChange={(value) => setPlanId(value || null)}
              options={[
                { value: "", label: "Todos" },
                ...(plans ?? []).map((plan) => ({ value: plan.id, label: plan.name })),
              ]}
              placeholder="Todos"
            />
          </div>
          <div className="w-44">
            <Select
              label="Estado"
              value={status}
              onChange={(value) => setStatus((value as EditionStatus) || null)}
              options={[{ value: "", label: "Todos" }, ...STATUS_OPTIONS]}
              placeholder="Todos"
            />
          </div>
          <div className="w-32">
            <Input
              label="Año"
              inputMode="numeric"
              placeholder="2026"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              error={yearOutOfRange ? `Entre ${MIN_CYCLE_YEAR} y ${MAX_CYCLE_YEAR}` : undefined}
            />
          </div>
        </div>
        <Link href={ADMIN_ROUTES.editionNew} className={getButtonClassName("primary", "md")}>
          <Plus size={16} weight="bold" aria-hidden="true" />
          Nueva edición
        </Link>
      </div>

      <Card className="p-0">
        {loadError ? (
          <div className="p-6">
            <ErrorState description={loadError} onRetry={retry} />
          </div>
        ) : rows === null ? (
          <div className="flex flex-col gap-2 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CalendarBlank}
            title={isFiltered ? "Sin resultados" : "Todavía no hay ediciones"}
            description={
              isFiltered
                ? "Ninguna edición coincide con estos filtros."
                : "Crea la edición del próximo ciclo para que las cajas salgan con su contenido."
            }
            action={
              !isFiltered ? (
                <Link
                  href={ADMIN_ROUTES.editionNew}
                  className={getButtonClassName("secondary", "sm")}
                >
                  Nueva edición
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="p-2">
            <Table columns={columns} rows={rows} rowKey={(edition) => edition.id} />
          </div>
        )}
      </Card>
    </div>
  );
}
