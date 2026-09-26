"use client";

import { useState } from "react";
import { SHIPPING_LABEL_STATUS_LABELS, type AdminOrder } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { formatDateTime } from "@/lib/format-date";
import type { OrderCapabilities } from "./order-capabilities";
import { handleOrderError } from "./handle-order-error";

interface OrderLabelPanelProps {
  order: AdminOrder;
  capabilities: OrderCapabilities;
  onOrderUpdated: (order: AdminOrder) => void;
  refreshOrder: () => void;
}

/** Estado de la guía de envío (ciclo propio, independiente de `status`) más
 * el reintento — sección propia dentro del bloque de Envío. */
function OrderLabelPanel({ order, capabilities, onOrderUpdated, refreshOrder }: OrderLabelPanelProps) {
  const { toast } = useToast();
  const label = order.label;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  if (!label) return null;

  async function handleRetry() {
    setRetrying(true);
    setConflict(null);
    try {
      const response = await apiRequest<AdminOrder>(`/api/v1/admin/orders/${order.id}/label/retry`, {
        method: "POST",
        authenticated: true,
      });
      onOrderUpdated(response.data);
      toast({ variant: "success", title: "Reintento de guía solicitado" });
      setConfirmOpen(false);
    } catch (error) {
      handleOrderError({ error, setConflict, toast, title: "No se pudo reintentar la guía", refresh: refreshOrder });
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">Guía</span>
          <Badge color="neutral">{SHIPPING_LABEL_STATUS_LABELS[label.status]}</Badge>
        </div>
        <div className="flex items-center gap-3">
          {label.labelUrl ? (
            <a href={label.labelUrl} target="_blank" rel="noreferrer" className="text-body-sm text-primary-action hover:underline">
              Ver guía (PDF)
            </a>
          ) : null}
          <Button size="sm" variant="secondary" onClick={() => setConfirmOpen(true)} disabled={!capabilities.canRetryLabel}>
            Reintentar guía
          </Button>
        </div>
      </div>
      {!capabilities.canRetryLabel ? (
        <p className="mt-1.5 text-body-sm text-muted-foreground">{capabilities.retryLabelBlockedReason}</p>
      ) : null}
      {label.lastError ? <p className="mt-1.5 text-body-sm text-destructive-action">{label.lastError}</p> : null}
      {label.attempts > 0 ? (
        <p className="mt-1.5 text-body-sm text-muted-foreground">
          {label.attempts} {label.attempts === 1 ? "intento" : "intentos"}
          {label.nextAttemptAt ? ` · próximo intento el ${formatDateTime(label.nextAttemptAt)}` : ""}
        </p>
      ) : null}

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
          Se reintentará la compra o consulta de la guía para el pedido {order.orderNumber}.
        </p>
      </ConfirmModal>
    </div>
  );
}

export { OrderLabelPanel };
