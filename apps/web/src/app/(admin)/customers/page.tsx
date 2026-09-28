"use client";

import { useState } from "react";
import Link from "next/link";
import { Users } from "@phosphor-icons/react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, type TableColumn } from "@/components/ui/table";
import { useDebouncedValue } from "@/components/inventory/use-debounced-value";
import { useCustomerList } from "@/components/customers/use-customer-list";
import { SubscriptionStatusBadge } from "@/components/customers/subscription-status-badge";
import { formatMoneyMXN } from "@/lib/format-money";
import { formatShortDate } from "@/lib/format-date";
import type { AdminCustomerListItem } from "@esencia-glow/shared";

const ITEM_LABEL = { singular: "cliente", plural: "clientes" };

/**
 * Milestone 2.6 — Clientes: tabla densa (mismo patrón que Categorías/
 * Inventario), una fila por cliente con todas las columnas visibles de una
 * vez. El nombre y el correo van juntos en la primera columna (mismo
 * criterio que `order-row.tsx`), el resto son cifras alineadas a la
 * derecha. Propuesta A elegida por Manuel de tres presentadas en
 * `/customers/preview`.
 */
export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { items, meta, setPage, loadError, retry } = useCustomerList(debouncedSearch);
  const isFiltered = Boolean(debouncedSearch);

  const columns: TableColumn<AdminCustomerListItem>[] = [
    {
      header: "Cliente",
      render: (row) => (
        <Link href={`/customers/${row.id}`} className="hover:underline focus-visible:underline">
          <span className="block text-body text-foreground">
            {row.firstName} {row.lastName}
          </span>
          <span className="block text-body-sm text-muted-foreground-strong">{row.email}</span>
        </Link>
      ),
    },
    {
      header: "Alta",
      render: (row) => formatShortDate(row.createdAt),
    },
    { header: "Pedidos", align: "right", render: (row) => row.stats.orderCount },
    { header: "Gastado", align: "right", render: (row) => formatMoneyMXN(row.stats.spentCents) },
    {
      header: "Último pedido",
      align: "right",
      render: (row) => (row.stats.lastOrderAt ? formatShortDate(row.stats.lastOrderAt) : "—"),
    },
    {
      header: "Suscripción",
      render: (row) => <SubscriptionStatusBadge status={row.subscriptionStatus} />,
    },
  ];

  return (
    <div>
      <div className="mb-6 w-72">
        <Input
          label="Buscar"
          placeholder="Busca por nombre o correo"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
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
            icon={Users}
            title={isFiltered ? "Sin resultados" : "Todavía no hay clientes"}
            description={
              isFiltered
                ? "Ningún cliente coincide con esa búsqueda."
                : "Aquí aparecerán las cuentas de tus clientas en cuanto se registren."
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
