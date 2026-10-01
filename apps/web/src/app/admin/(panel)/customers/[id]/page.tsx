"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Package } from "@phosphor-icons/react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, type TableColumn } from "@/components/ui/table";
import { useAdminCustomer } from "@/components/customers/use-admin-customer";
import { useCustomerOrders } from "@/components/customers/use-customer-orders";
import { SubscriptionStatusBadge } from "@/components/customers/subscription-status-badge";
import { formatMoneyMXN } from "@/lib/format-money";
import { formatDateTime, formatShortDate } from "@/lib/format-date";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import type { AdminOrder } from "@esencia-glow/shared";
import { ADMIN_ROUTES } from "@/lib/admin-routes";

/**
 * Milestone 2.6 — detalle de cliente: una sola columna de Cards apiladas
 * (mismo patrón que `/orders/[id]`): Cliente, Suscripción, Dirección más
 * reciente, Pedidos. El badge de suscripción va junto al nombre SIEMPRE
 * visible (Sí/No es honesto incluso sin cuenta — PRODUCT.md principio 3,
 * "el estado siempre es honesto"), a pedido de Manuel al elegir esta
 * propuesta.
 */
export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const { customer, loadError } = useAdminCustomer(params.id);
  const { orders, loadError: ordersError } = useCustomerOrders(params.id);

  if (loadError) return <ErrorState description={loadError} />;

  if (!customer) {
    return (
      <div className="flex max-w-5xl flex-col gap-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const columns: TableColumn<AdminOrder>[] = [
    {
      header: "Folio",
      render: (order) => (
        <Link href={ADMIN_ROUTES.order(order.id)} className="font-mono tabular-nums hover:underline focus-visible:underline">
          {order.orderNumber}
        </Link>
      ),
    },
    { header: "Fecha", render: (order) => formatShortDate(order.createdAt) },
    { header: "Estatus", render: (order) => <OrderStatusBadge status={order.status} /> },
    { header: "Total", align: "right", render: (order) => formatMoneyMXN(order.totals.totalCents) },
  ];

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-page-title text-foreground">
            {customer.firstName} {customer.lastName}
          </h2>
          <p className="text-body text-muted-foreground-strong">{customer.email}</p>
        </div>
        <SubscriptionStatusBadge status={customer.subscription?.status ?? null} />
      </div>

      <Card>
        <p className="mb-4 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">Cliente</p>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">Correo verificado</dt>
            <dd className="mt-0.5 text-body text-foreground">{customer.emailVerified ? "Sí" : "No"}</dd>
          </div>
          <div>
            <dt className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">Cliente desde</dt>
            <dd className="mt-0.5 text-body text-foreground">{formatDateTime(customer.createdAt)}</dd>
          </div>
        </dl>
      </Card>

      {customer.subscription ? (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <p className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">Suscripción</p>
            <SubscriptionStatusBadge status={customer.subscription.status} />
          </div>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">Plan</dt>
              <dd className="mt-0.5 text-body text-foreground">{customer.subscription.plan?.name ?? "—"}</dd>
            </div>
            {customer.subscription.currentPeriodEnd ? (
              <div>
                <dt className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">Próximo cobro</dt>
                <dd className="mt-0.5 text-body text-foreground">{formatShortDate(customer.subscription.currentPeriodEnd)}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      ) : null}

      {customer.lastShippingAddress ? (
        <Card>
          <p className="mb-4 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
            Última dirección de envío
          </p>
          <p className="text-body text-foreground">
            {customer.lastShippingAddress.fullName} · {customer.lastShippingAddress.phone}
          </p>
          <p className="text-body-sm text-muted-foreground-strong">
            {customer.lastShippingAddress.street} {customer.lastShippingAddress.exteriorNumber}
            {customer.lastShippingAddress.interiorNumber ? ` int. ${customer.lastShippingAddress.interiorNumber}` : ""},{" "}
            {customer.lastShippingAddress.neighborhood}, {customer.lastShippingAddress.city},{" "}
            {customer.lastShippingAddress.state} {customer.lastShippingAddress.postalCode}
          </p>
        </Card>
      ) : null}

      <Card className="p-0">
        <p className="p-6 pb-0 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">Pedidos</p>
        {ordersError ? (
          <div className="p-6">
            <ErrorState description={ordersError} />
          </div>
        ) : orders === null ? (
          <div className="flex flex-col gap-2 p-6">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState icon={Package} title="Sin pedidos" description="Este cliente todavía no ha comprado nada." />
        ) : (
          <div className="p-2">
            <Table columns={columns} rows={orders} rowKey={(order) => order.id} />
          </div>
        )}
      </Card>
    </div>
  );
}
