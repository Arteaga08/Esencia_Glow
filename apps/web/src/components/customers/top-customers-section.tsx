"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy } from "@phosphor-icons/react";
import { TopCustomersPeriod, TopCustomersSort, type TopCustomerRow } from "@esencia-glow/shared";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, type TableColumn } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { formatMoneyMXN } from "@/lib/format-money";
import { formatShortDate } from "@/lib/format-date";
import { useTopCustomers } from "./use-top-customers";
import { ADMIN_ROUTES } from "@/lib/admin-routes";

const PERIOD_TABS = [
  { id: TopCustomersPeriod.WEEK, label: "Semana" },
  { id: TopCustomersPeriod.MONTH, label: "Mes" },
  { id: TopCustomersPeriod.YEAR, label: "Año" },
];

const SORT_OPTIONS = [
  { value: TopCustomersSort.SPENT, label: "Monto gastado" },
  { value: TopCustomersSort.ORDERS, label: "Número de pedidos" },
];

const EMPTY_DESCRIPTION: Record<TopCustomersPeriod, string> = {
  [TopCustomersPeriod.WEEK]: "Nadie ha completado una compra desde el lunes.",
  [TopCustomersPeriod.MONTH]: "Nadie ha completado una compra en lo que va del mes.",
  [TopCustomersPeriod.YEAR]: "Nadie ha completado una compra en lo que va del año.",
};

/**
 * Milestone 2.6.1: top 10 de clientes por monto o por pedidos en el periodo
 * calendario en curso, arriba del listado completo. Misma Table que el
 * listado (DESIGN.md §5) con una columna de posición en PT Mono; sin
 * resaltar el podio, el rosa se queda en el tab activo (Regla del Listón).
 * El rango que se muestra es el que devolvió la API, no uno recalculado en
 * el navegador.
 */
function TopCustomersSection() {
  const [period, setPeriod] = useState(TopCustomersPeriod.MONTH);
  const [sortBy, setSortBy] = useState(TopCustomersSort.SPENT);
  const { result, isRefreshing, loadError, retry } = useTopCustomers(period, sortBy);

  const columns: TableColumn<TopCustomerRow>[] = [
    {
      header: "#",
      className: "w-12",
      render: (row) => (
        <span className="font-mono tabular-nums text-muted-foreground-strong">
          {(result?.rows.indexOf(row) ?? 0) + 1}
        </span>
      ),
    },
    {
      header: "Cliente",
      render: (row) => (
        <Link href={ADMIN_ROUTES.customer(row.id)} className="hover:underline focus-visible:underline">
          <span className="block text-body text-foreground">
            {row.firstName} {row.lastName}
          </span>
          <span className="block text-body-sm text-muted-foreground-strong">{row.email}</span>
        </Link>
      ),
    },
    { header: "Pedidos", align: "right", render: (row) => row.orderCount },
    { header: "Gastado", align: "right", render: (row) => formatMoneyMXN(row.spentCents) },
  ];

  return (
    <section aria-labelledby="top-customers-title" className="mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="top-customers-title" className="text-section-title text-foreground">
            Mejores clientes
          </h2>
          <p className="mt-1 text-body-sm text-muted-foreground-strong">
            {result ? `Del ${formatShortDate(result.from)} a hoy` : " "}
          </p>
        </div>
        <Select
          label="Ordenar por"
          value={sortBy}
          onChange={(value) => setSortBy(value as TopCustomersSort)}
          options={SORT_OPTIONS}
          className="w-56"
        />
      </div>

      <Card className="p-0">
        <div className="px-6 pt-4">
          <Tabs
            items={PERIOD_TABS}
            activeId={period}
            onChange={(id) => setPeriod(id as TopCustomersPeriod)}
            ariaLabel="Periodo del ranking"
          />
        </div>

        <div role="tabpanel" id={`tabpanel-${period}`} aria-labelledby={`tab-${period}`} aria-busy={isRefreshing}>
          {loadError ? (
            <div className="p-6">
              <ErrorState description={loadError} onRetry={retry} />
            </div>
          ) : result === null ? (
            <div className="flex flex-col gap-2 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : result.rows.length === 0 ? (
            <EmptyState icon={Trophy} title="Sin compras en este periodo" description={EMPTY_DESCRIPTION[result.period]} />
          ) : (
            <div className={"p-2 transition-opacity duration-200 " + (isRefreshing ? "opacity-60" : "opacity-100")}>
              <Table columns={columns} rows={result.rows} rowKey={(row) => row.id} />
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}

export { TopCustomersSection };
