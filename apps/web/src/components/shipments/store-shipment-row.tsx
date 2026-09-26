"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ORDER_PRIORITY_LABELS,
  OrderPriority,
  SHIPMENT_TRACKING_STATUS_LABELS,
  SHIPPING_LABEL_STATUS_LABELS,
  ShipmentTrackingStatus,
  ShippingLabelStatus,
} from "@esencia-glow/shared";
import { Badge, type BadgeColorValue } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api";
import { formatShortDate } from "@/lib/format-date";
import type { AdminShipmentRow } from "@/lib/types/admin-shipment";
import { handleShipmentError } from "./handle-shipment-error";

const RETRYABLE_LABEL_STATUSES: ShippingLabelStatus[] = [ShippingLabelStatus.NEEDS_REVIEW, ShippingLabelStatus.FAILED];

const LABEL_COLOR: Record<ShippingLabelStatus, BadgeColorValue> = {
  [ShippingLabelStatus.PENDING]: "neutral",
  [ShippingLabelStatus.REQUESTED]: "neutral",
  [ShippingLabelStatus.PROCESSING]: "warning",
  [ShippingLabelStatus.READY]: "success",
  [ShippingLabelStatus.FAILED]: "danger",
  [ShippingLabelStatus.NEEDS_REVIEW]: "danger",
};

const TRACKING_COLOR: Record<ShipmentTrackingStatus, BadgeColorValue> = {
  [ShipmentTrackingStatus.LABEL_CREATED]: "neutral",
  [ShipmentTrackingStatus.PICKED_UP]: "neutral",
  [ShipmentTrackingStatus.IN_TRANSIT]: "neutral",
  [ShipmentTrackingStatus.OUT_FOR_DELIVERY]: "neutral",
  [ShipmentTrackingStatus.DELIVERED]: "success",
  [ShipmentTrackingStatus.EXCEPTION]: "danger",
  [ShipmentTrackingStatus.RETURNED]: "danger",
};

interface StoreShipmentRowProps {
  shipment: AdminShipmentRow;
  /** Se llama tras un reintento exitoso — la fila no intenta mutarse a sí
   * misma con la forma de `AdminOrder` que devuelve el endpoint (no
   * coincide con `AdminShipmentRow`), simplemente pide a la cola que
   * vuelva a traer esta página. */
  onRetried: () => void;
}

/** Dos renglones, mismo estilo que `order-row.tsx` (2.3): folio + cliente +
 * prioridad arriba, destino + fecha + guía abajo. El detalle profundo del
 * pedido sigue viviendo en `/orders/[id]` — el link de aquí lleva ahí. */
function StoreShipmentRow({ shipment, onRetried }: StoreShipmentRowProps) {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  const customerName = shipment.customer
    ? `${shipment.customer.firstName} ${shipment.customer.lastName}`
    : shipment.fallbackName;
  const canRetry = Boolean(shipment.labelStatus && RETRYABLE_LABEL_STATUSES.includes(shipment.labelStatus));

  async function handleRetry() {
    setRetrying(true);
    setConflict(null);
    try {
      await apiRequest(`/api/v1/admin/orders/${shipment.id}/label/retry`, { method: "POST", authenticated: true });
      toast({ variant: "success", title: "Reintento de guía solicitado" });
      setConfirmOpen(false);
      onRetried();
    } catch (error) {
      handleShipmentError({ error, setConflict, toast, title: "No se pudo reintentar la guía", refresh: onRetried });
    } finally {
      setRetrying(false);
    }
  }

  return (
    <li className="border-t border-border first:border-t-0">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <Link href={`/orders/${shipment.id}`} className="flex min-w-0 flex-col gap-0.5 hover:opacity-80">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-body-sm tabular-nums text-foreground">{shipment.orderNumber}</span>
            <span className="truncate text-body text-foreground">{customerName}</span>
            {shipment.priority !== OrderPriority.NORMAL ? (
              <Badge color={shipment.priority === OrderPriority.URGENT ? "danger" : "warning"}>
                {ORDER_PRIORITY_LABELS[shipment.priority]}
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-body-sm text-muted-foreground">
            <span>
              {shipment.destinationCity}, {shipment.destinationState}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatShortDate(shipment.createdAt)}</span>
            {shipment.trackingNumber ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{shipment.trackingNumber}</span>
              </>
            ) : null}
          </div>
          {shipment.labelLastError ? (
            <p className="max-w-[52ch] text-body-sm text-destructive-action">
              {shipment.labelLastError}
              {shipment.labelAttempts > 0
                ? ` (${shipment.labelAttempts} ${shipment.labelAttempts === 1 ? "intento" : "intentos"})`
                : ""}
            </p>
          ) : null}
        </Link>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            {shipment.labelStatus ? (
              <Badge color={LABEL_COLOR[shipment.labelStatus]}>{SHIPPING_LABEL_STATUS_LABELS[shipment.labelStatus]}</Badge>
            ) : null}
            {shipment.trackingStatus ? (
              <Badge color={TRACKING_COLOR[shipment.trackingStatus]}>
                {SHIPMENT_TRACKING_STATUS_LABELS[shipment.trackingStatus]}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {shipment.labelUrl ? (
              <a
                href={shipment.labelUrl}
                target="_blank"
                rel="noreferrer"
                className="text-body-sm text-primary-action hover:underline"
              >
                Ver guía (PDF)
              </a>
            ) : null}
            {canRetry ? (
              <Button size="sm" variant="secondary" onClick={() => setConfirmOpen(true)}>
                Reintentar guía
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Reintentar guía"
        confirmLabel="Reintentar"
        loading={retrying}
        error={conflict}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleRetry}
      >
        <p className="text-body-sm text-muted-foreground-strong">
          Se reintentará la compra o consulta de la guía para el pedido {shipment.orderNumber}.
        </p>
      </ConfirmModal>
    </li>
  );
}

export { StoreShipmentRow };
