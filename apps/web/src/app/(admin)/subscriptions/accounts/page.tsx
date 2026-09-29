"use client";

import { useState } from "react";
import Link from "next/link";
import { UsersThree } from "@phosphor-icons/react";
import { SubscriptionStatus, SUBSCRIPTION_STATUS_LABELS } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, type TableColumn } from "@/components/ui/table";
import { useDebouncedValue } from "@/components/inventory/use-debounced-value";
import { SubscriptionStatusBadge } from "@/components/customers/subscription-status-badge";
import { EnrollmentWindowPanel } from "@/components/subscription-accounts/enrollment-window-panel";
import { useSubscriptionAccountList } from "@/components/subscription-accounts/use-subscription-account-list";
import { usePlanFilterOptions } from "@/components/subscription-accounts/use-plan-filter-options";
import { useInitialQueryParam } from "@/lib/hooks/use-initial-query-param";
import { formatShortDate } from "@/lib/format-date";
import type { AdminSubscriptionAccountListItem } from "@/lib/types/admin-subscription";

const ITEM_LABEL = { singular: "cuenta", plural: "cuentas" };

const STATUS_OPTIONS = Object.values(SubscriptionStatus).map((status) => ({
  value: status,
  label: SUBSCRIPTION_STATUS_LABELS[status],
}));

const VALID_SUBSCRIPTION_STATUSES: string[] = Object.values(SubscriptionStatus);

/** `?status=past_due` o `?attention=true` desde la tarjeta de Suscripciones
 * del Resumen (Milestone 2.9) — excluyentes, mismo `.oxor` del backend. */
function resolveInitialStatus(raw: string | null): SubscriptionStatus | null {
  return raw && VALID_SUBSCRIPTION_STATUSES.includes(raw) ? (raw as SubscriptionStatus) : null;
}

/**
 * Milestone 2.7a — Cuentas de suscripción: tabla densa (mismo patrón que
 * Clientes/2.6), una fila por cuenta con todas las columnas visibles de una
 * vez. Propuesta A elegida por Manuel de tres presentadas en
 * `/subscriptions/accounts/preview` (borrado tras la elección). "Requiere
 * atención" es un botón toggle que apaga el filtro de estado — son
 * excluyentes en el backend (`.oxor`, ver
 * subscription-account-admin.validator.ts).
 */
export default function SubscriptionAccountsPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const initialStatus = useInitialQueryParam("status");
  const initialAttention = useInitialQueryParam("attention");
  const [status, setStatus] = useState<SubscriptionStatus | null>(() => resolveInitialStatus(initialStatus));
  const [planId, setPlanId] = useState<string | null>(null);
  const [attention, setAttention] = useState(() => initialAttention === "true");
  const planOptions = usePlanFilterOptions();

  const { items, meta, setPage, loadError, retry } = useSubscriptionAccountList({
    search: debouncedSearch,
    status,
    planId,
    attention,
  });
  const isFiltered = Boolean(debouncedSearch || status || planId || attention);

  const columns: TableColumn<AdminSubscriptionAccountListItem>[] = [
    {
      header: "Suscriptora",
      render: (row) => (
        <Link href={`/subscriptions/accounts/${row.id}`} className="hover:underline focus-visible:underline">
          <span className="block text-body text-foreground">
            {row.user.firstName} {row.user.lastName}
          </span>
          <span className="block text-body-sm text-muted-foreground-strong">{row.user.email}</span>
        </Link>
      ),
    },
    { header: "Plan", render: (row) => row.plan?.name ?? "—" },
    { header: "Estado", render: (row) => <SubscriptionStatusBadge status={row.status} /> },
    {
      header: "Próximo cobro",
      align: "right",
      render: (row) => (row.currentPeriodEnd ? formatShortDate(row.currentPeriodEnd) : "—"),
    },
    {
      header: "Cancela",
      align: "right",
      render: (row) => (row.cancelAtPeriodEnd ? <Badge color="warning">Al fin de período</Badge> : "—"),
    },
    {
      header: "Cobros fallidos",
      align: "right",
      render: (row) => (row.dunningAttempts > 0 ? <Badge color="danger">{row.dunningAttempts}</Badge> : "—"),
    },
    { header: "Alta", align: "right", render: (row) => formatShortDate(row.createdAt) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <EnrollmentWindowPanel />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-72">
          <Input
            label="Buscar"
            placeholder="Busca por nombre o correo"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="w-48">
          <Select
            label="Estado"
            value={status}
            onChange={(value) => {
              setStatus((value as SubscriptionStatus) || null);
              if (value) setAttention(false);
            }}
            options={[{ value: "", label: "Todos" }, ...STATUS_OPTIONS]}
            placeholder="Todos"
            disabled={attention}
          />
        </div>
        <div className="w-56">
          <Select
            label="Plan"
            value={planId}
            onChange={(value) => setPlanId(value || null)}
            options={[
              { value: "", label: "Todos" },
              ...planOptions.map((plan) => ({ value: plan.id, label: plan.name })),
            ]}
            placeholder="Todos"
          />
        </div>
        <Button
          variant={attention ? "primary" : "secondary"}
          onClick={() => {
            setAttention((prev) => !prev);
            if (!attention) setStatus(null);
          }}
        >
          Requiere atención
        </Button>
      </div>

      <Card className="p-0">
        {loadError ? (
          <div className="p-6">
            <ErrorState description={loadError} onRetry={retry} />
          </div>
        ) : items === null ? (
          <div className="flex flex-col gap-2 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={UsersThree}
            title={isFiltered ? "Sin resultados" : "Todavía no hay suscriptoras"}
            description={
              isFiltered
                ? "Ninguna cuenta coincide con estos filtros."
                : "Aquí aparecerán las cuentas en cuanto alguien se suscriba."
            }
          />
        ) : (
          <div className="p-2">
            <Table columns={columns} rows={items} rowKey={(row) => row.id} />
          </div>
        )}
      </Card>

      {meta ? <Pagination meta={meta} onPageChange={setPage} itemLabel={ITEM_LABEL} /> : null}
    </div>
  );
}
