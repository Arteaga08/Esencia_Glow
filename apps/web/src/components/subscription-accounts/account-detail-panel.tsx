"use client";

import Link from "next/link";
import { SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_SHIPMENT_STATUS_LABELS } from "@esencia-glow/shared";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, type TableColumn } from "@/components/ui/table";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { SubscriptionStatusBadge } from "@/components/customers/subscription-status-badge";
import { formatDateTime, formatShortDate } from "@/lib/format-date";
import type { AdminSubscriptionShipment } from "@/lib/types/admin-subscription";
import { useSubscriptionAccount } from "./use-subscription-account";
import { useAccountShipments } from "./use-account-shipments";
import { useAccountActivity } from "./use-account-activity";
import { ADMIN_ROUTES } from "@/lib/admin-routes";

const FIELD_LABEL_CLASSNAME = "font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong";

/**
 * Detalle de una cuenta de suscripción (Milestone 2.7a) — mismo patrón de
 * tarjetas apiladas que `/customers/[id]`: Cuenta, Historial de estados,
 * Cajas del ciclo, Actividad. Componente compartido entre las 3 propuestas
 * de diseño (el detalle no es lo que varía entre ellas, ver el plan) y la
 * página final `/subscriptions/accounts/[id]`.
 */
function AccountDetailPanel({ accountId }: { accountId: string }) {
  const { account, loadError } = useSubscriptionAccount(accountId);
  const { shipments, loadError: shipmentsError } = useAccountShipments(accountId);
  const { entries, loadError: activityError } = useAccountActivity(accountId);

  if (loadError) return <ErrorState description={loadError} />;

  if (!account) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const shipmentColumns: TableColumn<AdminSubscriptionShipment>[] = [
    { header: "Ciclo", render: (row) => `${row.cycleMonth}/${row.cycleYear}` },
    {
      header: "Estatus",
      render: (row) => SUBSCRIPTION_SHIPMENT_STATUS_LABELS[row.status],
    },
    { header: "Guía", render: (row) => row.trackingNumber ?? "—" },
    { header: "Actualizada", align: "right", render: (row) => formatShortDate(row.createdAt) },
  ];

  const historyItems: TimelineItem[] = account.statusHistory.map((entry, index) => ({
    id: `${entry.status}-${entry.at}-${index}`,
    title: SUBSCRIPTION_STATUS_LABELS[entry.status],
    at: entry.at,
    meta: entry.actorType === "system" ? "Automático" : "Clienta",
  }));

  const activityItems: TimelineItem[] = (entries ?? []).map((entry, index) => ({
    id: `${entry.action}-${entry.at}-${index}`,
    title: entry.action,
    at: entry.at,
    meta: entry.actorId ? undefined : "Sistema",
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-page-title text-foreground">
            {account.user.firstName} {account.user.lastName}
          </h2>
          <p className="text-body text-muted-foreground-strong">{account.user.email}</p>
        </div>
        <SubscriptionStatusBadge status={account.status} />
      </div>

      <Card>
        <p className={`mb-4 ${FIELD_LABEL_CLASSNAME}`}>Cuenta</p>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className={FIELD_LABEL_CLASSNAME}>Plan</dt>
            <dd className="mt-0.5 text-body text-foreground">{account.plan?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className={FIELD_LABEL_CLASSNAME}>Alta</dt>
            <dd className="mt-0.5 text-body text-foreground">
              {account.startedAt ? formatDateTime(account.startedAt) : "—"}
            </dd>
          </div>
          <div>
            <dt className={FIELD_LABEL_CLASSNAME}>Próximo cobro</dt>
            <dd className="mt-0.5 text-body text-foreground">
              {account.currentPeriodEnd ? formatDateTime(account.currentPeriodEnd) : "—"}
            </dd>
          </div>
          <div>
            <dt className={FIELD_LABEL_CLASSNAME}>Cancela al fin de período</dt>
            <dd className="mt-0.5 text-body text-foreground">{account.cancelAtPeriodEnd ? "Sí" : "No"}</dd>
          </div>
          {account.pastDueSince ? (
            <div>
              <dt className={FIELD_LABEL_CLASSNAME}>Cobro fallando desde</dt>
              <dd className="mt-0.5 text-body text-destructive-action">{formatDateTime(account.pastDueSince)}</dd>
            </div>
          ) : null}
          {account.dunningAttempts > 0 ? (
            <div>
              <dt className={FIELD_LABEL_CLASSNAME}>Intentos de cobro fallidos</dt>
              <dd className="mt-0.5 text-body text-destructive-action">{account.dunningAttempts}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card>
        <p className={`mb-4 ${FIELD_LABEL_CLASSNAME}`}>Historial de estados</p>
        <Timeline items={historyItems} emptyMessage="Sin historial todavía." />
      </Card>

      <Card className="p-0">
        <div className="flex items-center justify-between p-6 pb-0">
          <p className={FIELD_LABEL_CLASSNAME}>Cajas del ciclo</p>
          <Link href={ADMIN_ROUTES.shipments} className="text-body-sm text-primary-action hover:underline focus-visible:underline">
            Ver panel de envíos
          </Link>
        </div>
        {shipmentsError ? (
          <div className="p-6">
            <ErrorState description={shipmentsError} />
          </div>
        ) : shipments === null ? (
          <div className="flex flex-col gap-2 p-6">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : shipments.length === 0 ? (
          <div className="p-6">
            <p className="text-body-sm text-muted-foreground-strong">Todavía no se ha armado ninguna caja para esta cuenta.</p>
          </div>
        ) : (
          <div className="p-2">
            <Table columns={shipmentColumns} rows={shipments} rowKey={(row) => row.id} />
          </div>
        )}
      </Card>

      <Card>
        <p className={`mb-4 ${FIELD_LABEL_CLASSNAME}`}>Actividad</p>
        {activityError ? (
          <ErrorState description={activityError} />
        ) : entries === null ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <Timeline items={activityItems} emptyMessage="Sin actividad registrada todavía." />
        )}
      </Card>
    </div>
  );
}

export { AccountDetailPanel };
