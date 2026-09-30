"use client";

import Link from "next/link";
import { ListChecks, PencilSimple, Plus } from "@phosphor-icons/react";
import { getButtonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, type TableColumn } from "@/components/ui/table";
import {
  AnnualPrice,
  MonthlyPrice,
  SeatCount,
} from "@/components/subscription-plans/plan-price-summary";
import { PlanStatusBadge } from "@/components/subscription-plans/plan-status-badge";
import { useSubscriptionPlans } from "@/components/subscription-plans/use-subscription-plans";
import type { AdminSubscriptionPlan } from "@/lib/types/admin-subscription";

/**
 * Milestone 2.7b-2 — Planes de suscripción: tabla densa (mismo patrón que
 * Cuentas y Clientes), Propuesta A elegida por Manuel de tres presentadas
 * en `/subscriptions/plans/preview` (borrado tras la elección). Cada plan es
 * UNA suscripción con su precio mensual y, opcionalmente, el anual. El
 * título de página lo pone `TopBar`.
 */
export default function SubscriptionPlansPage() {
  const { plans, loadError, retry } = useSubscriptionPlans();

  const columns: TableColumn<AdminSubscriptionPlan>[] = [
    {
      header: "Plan",
      render: (plan) => (
        <Link
          href={`/subscriptions/plans/${plan.id}`}
          className="hover:underline focus-visible:underline"
        >
          <span className="block text-body text-foreground">{plan.name}</span>
          {plan.shortDescription ? (
            <span className="block text-body-sm text-muted-foreground-strong">
              {plan.shortDescription}
            </span>
          ) : null}
        </Link>
      ),
    },
    { header: "Mensual", align: "right", render: (plan) => <MonthlyPrice plan={plan} /> },
    { header: "Anual", align: "right", render: (plan) => <AnnualPrice plan={plan} /> },
    { header: "Cupo", align: "right", render: (plan) => <SeatCount plan={plan} /> },
    { header: "Orden", align: "right", render: (plan) => plan.sortOrder },
    { header: "Estado", render: (plan) => <PlanStatusBadge isActive={plan.isActive} /> },
    {
      header: "Acciones",
      align: "right",
      render: (plan) => (
        <div className="flex justify-end gap-1">
          <Link
            href={`/subscriptions/plans/${plan.id}`}
            aria-label={`Editar ${plan.name}`}
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
      <div className="flex justify-end">
        <Link href="/subscriptions/plans/new" className={getButtonClassName("primary", "md")}>
          <Plus size={16} weight="bold" aria-hidden="true" />
          Nuevo plan
        </Link>
      </div>

      <Card className="p-0">
        {loadError ? (
          <div className="p-6">
            <ErrorState description={loadError} onRetry={retry} />
          </div>
        ) : plans === null ? (
          <div className="flex flex-col gap-2 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : plans.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Todavía no hay planes"
            description="Crea el primer plan para abrir la suscripción curada."
            action={
              <Link
                href="/subscriptions/plans/new"
                className={getButtonClassName("secondary", "sm")}
              >
                Nuevo plan
              </Link>
            }
          />
        ) : (
          <div className="p-2">
            <Table columns={columns} rows={plans} rowKey={(plan) => plan.id} />
          </div>
        )}
      </Card>
    </div>
  );
}
