"use client";

import { useState } from "react";
import {
  SUBSCRIPTION_SHIPMENT_STATUS_LABELS,
  SubscriptionShipmentStatus,
  type ShippingCarrier,
} from "@esencia-glow/shared";
import { Badge, type BadgeColorValue } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api";
import type { AdminSubscriptionShipment } from "@/lib/types/admin-subscription";
import { handleShipmentError } from "./handle-shipment-error";
import { SubscriptionShipModal } from "./subscription-ship-modal";

const STATUS_COLOR: Record<SubscriptionShipmentStatus, BadgeColorValue> = {
  [SubscriptionShipmentStatus.PENDING]: "warning",
  [SubscriptionShipmentStatus.PROCESSING]: "warning",
  [SubscriptionShipmentStatus.SHIPPED]: "neutral",
  [SubscriptionShipmentStatus.DELIVERED]: "success",
  [SubscriptionShipmentStatus.CANCELED]: "danger",
};

/** `SHIPMENT_TRANSITIONS` del backend (`subscription-shipment-state.ts`):
 * un único "siguiente paso" natural por estatus, igual que
 * `ADMIN_NEXT_STATUS` en `order-capabilities.ts` — cancelar es la salida
 * secundaria, no la primaria. */
const NEXT_STATUS: Partial<Record<SubscriptionShipmentStatus, SubscriptionShipmentStatus>> = {
  [SubscriptionShipmentStatus.PENDING]: SubscriptionShipmentStatus.PROCESSING,
  [SubscriptionShipmentStatus.PROCESSING]: SubscriptionShipmentStatus.SHIPPED,
  [SubscriptionShipmentStatus.SHIPPED]: SubscriptionShipmentStatus.DELIVERED,
};

const NEXT_STATUS_LABEL: Partial<Record<SubscriptionShipmentStatus, string>> = {
  [SubscriptionShipmentStatus.PENDING]: "Marcar en preparación",
  [SubscriptionShipmentStatus.PROCESSING]: "Marcar como enviada",
  [SubscriptionShipmentStatus.SHIPPED]: "Marcar como entregada",
};

const CANCELABLE_FROM: SubscriptionShipmentStatus[] = [
  SubscriptionShipmentStatus.PENDING,
  SubscriptionShipmentStatus.PROCESSING,
];

interface SubscriptionShipmentRowProps {
  shipment: AdminSubscriptionShipment;
  onChanged: () => void;
}

function SubscriptionShipmentRow({ shipment, onChanged }: SubscriptionShipmentRowProps) {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  const customerName = shipment.customer
    ? `${shipment.customer.firstName} ${shipment.customer.lastName}`
    : "Clienta no encontrada";
  const next = NEXT_STATUS[shipment.status];
  const canCancel = CANCELABLE_FROM.includes(shipment.status);

  async function changeStatus(body: { status: SubscriptionShipmentStatus; carrier?: ShippingCarrier; trackingNumber?: string }) {
    setSaving(true);
    setConflict(null);
    try {
      await apiRequest(`/api/v1/admin/subscription-shipments/${shipment.id}/status`, {
        method: "PATCH",
        authenticated: true,
        body,
      });
      toast({ variant: "success", title: "Estatus actualizado" });
      setConfirmOpen(false);
      setCancelOpen(false);
      setShipOpen(false);
      onChanged();
    } catch (error) {
      handleShipmentError({ error, setConflict, toast, title: "No se pudo cambiar el estatus", refresh: onChanged });
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="border-t border-border first:border-t-0">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-body-sm tabular-nums text-foreground">
              {String(shipment.cycleMonth).padStart(2, "0")}/{shipment.cycleYear}
            </span>
            <span className="truncate text-body text-foreground">{customerName}</span>
            {shipment.editionIncident || shipment.inventoryIncident ? <Badge color="danger">Incidencia</Badge> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">
            <span>{shipment.planName}</span>
            {shipment.trackingNumber ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{shipment.trackingNumber}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {shipment.carrier ? (
            <span className="text-body-sm text-muted-foreground-strong">{shipment.carrier.toUpperCase()}</span>
          ) : null}
          <Badge color={STATUS_COLOR[shipment.status]}>{SUBSCRIPTION_SHIPMENT_STATUS_LABELS[shipment.status]}</Badge>
          {canCancel ? (
            <Button size="sm" variant="ghost" onClick={() => setCancelOpen(true)}>
              Cancelar
            </Button>
          ) : null}
          {next ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => (next === SubscriptionShipmentStatus.SHIPPED ? setShipOpen(true) : setConfirmOpen(true))}
            >
              {NEXT_STATUS_LABEL[shipment.status]}
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={NEXT_STATUS_LABEL[shipment.status] ?? ""}
        confirmLabel="Confirmar"
        loading={saving}
        error={conflict}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => next && changeStatus({ status: next })}
      >
        <p className="text-body-sm text-muted-foreground-strong">
          Se actualizará el estatus de esta caja del ciclo {shipment.cycleMonth}/{shipment.cycleYear}.
        </p>
      </ConfirmModal>

      <ConfirmModal
        open={cancelOpen}
        title="Cancelar envío"
        confirmLabel="Cancelar envío"
        variant="destructive"
        loading={saving}
        error={conflict}
        onCancel={() => setCancelOpen(false)}
        onConfirm={() => changeStatus({ status: SubscriptionShipmentStatus.CANCELED })}
      >
        <p className="text-body-sm text-muted-foreground-strong">
          Esta caja no se preparará ni se enviará este ciclo. La reserva de inventario se libera.
        </p>
      </ConfirmModal>

      <SubscriptionShipModal
        open={shipOpen}
        loading={saving}
        error={conflict}
        onCancel={() => setShipOpen(false)}
        onConfirm={(input) => changeStatus({ status: SubscriptionShipmentStatus.SHIPPED, ...input })}
      />
    </li>
  );
}

export { SubscriptionShipmentRow };
