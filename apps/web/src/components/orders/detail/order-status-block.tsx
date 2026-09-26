"use client";

import { useState } from "react";
import { ORDER_PRIORITY_LABELS, OrderPriority, OrderStatus, type AdminOrder } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { FieldError } from "@/components/ui/field-error";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { OrderCapabilities } from "./order-capabilities";
import { OrderShipmentModal } from "./order-shipment-modal";
import { handleOrderError } from "./handle-order-error";

const PRIORITY_OPTIONS = Object.values(OrderPriority).map((priority) => ({
  value: priority,
  label: ORDER_PRIORITY_LABELS[priority],
}));

interface OrderStatusBlockProps {
  order: AdminOrder;
  capabilities: OrderCapabilities;
  onOrderUpdated: (order: AdminOrder) => void;
  /** Refresca la bitácora (`/activity`) tras un cambio exitoso. */
  onOrderChanged: () => void;
  /** Relee el pedido (`GET /:id`) tras un 409 — sin esto `capabilities` se
   * queda con el estado viejo y el botón sigue ofreciendo la acción que
   * acaba de fallar por conflicto. */
  refreshOrder: () => void;
}

/** Avanzar estatus (un solo botón: la única transición legal), cancelar
 * (solo `pending`) y prioridad — las tres acciones que no tocan pago ni
 * envío directamente. */
function OrderStatusBlock({ order, capabilities, onOrderUpdated, onOrderChanged, refreshOrder }: OrderStatusBlockProps) {
  const { toast } = useToast();
  const [advancing, setAdvancing] = useState(false);
  const [advanceConflict, setAdvanceConflict] = useState<string | null>(null);
  const [shipmentModalOpen, setShipmentModalOpen] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelConflict, setCancelConflict] = useState<string | null>(null);

  const [priorityConflict, setPriorityConflict] = useState<string | null>(null);
  const [changingPriority, setChangingPriority] = useState(false);

  async function handleAdvance() {
    if (!capabilities.nextStatus) return;
    if (capabilities.requiresShipmentForNextStatus) {
      setShipmentModalOpen(true);
      return;
    }
    setAdvancing(true);
    setAdvanceConflict(null);
    try {
      const response = await apiRequest<AdminOrder>(`/api/v1/admin/orders/${order.id}/status`, {
        method: "PATCH",
        authenticated: true,
        body: { status: capabilities.nextStatus },
      });
      onOrderUpdated(response.data);
      onOrderChanged();
      toast({ variant: "success", title: "Estatus actualizado" });
    } catch (error) {
      handleOrderError({
        error,
        setConflict: setAdvanceConflict,
        toast,
        title: "No se pudo cambiar el estatus",
        refresh: refreshOrder,
      });
    } finally {
      setAdvancing(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    setCancelConflict(null);
    try {
      const response = await apiRequest<AdminOrder>(`/api/v1/admin/orders/${order.id}/status`, {
        method: "PATCH",
        authenticated: true,
        body: { status: OrderStatus.CANCELLED, ...(cancelReason.trim() ? { reason: cancelReason.trim() } : {}) },
      });
      onOrderUpdated(response.data);
      onOrderChanged();
      toast({ variant: "success", title: "Pedido cancelado" });
      setCancelOpen(false);
      setCancelReason("");
    } catch (error) {
      handleOrderError({
        error,
        setConflict: setCancelConflict,
        toast,
        title: "No se pudo cancelar el pedido",
        refresh: refreshOrder,
      });
    } finally {
      setCancelling(false);
    }
  }

  async function handlePriorityChange(priority: string) {
    setChangingPriority(true);
    setPriorityConflict(null);
    try {
      const response = await apiRequest<AdminOrder>(`/api/v1/admin/orders/${order.id}/priority`, {
        method: "PATCH",
        authenticated: true,
        body: { priority },
      });
      onOrderUpdated(response.data);
      onOrderChanged();
      toast({ variant: "success", title: "Prioridad actualizada" });
    } catch (error) {
      handleOrderError({
        error,
        setConflict: setPriorityConflict,
        toast,
        title: "No se pudo actualizar la prioridad",
        refresh: refreshOrder,
      });
    } finally {
      setChangingPriority(false);
    }
  }

  return (
    <Card>
      <p className="mb-4 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
        Estado del pedido
      </p>
      <div className="flex flex-col gap-4">
        <div className="w-56">
          <Select
            label="Prioridad"
            value={order.priority}
            onChange={handlePriorityChange}
            options={PRIORITY_OPTIONS}
            disabled={changingPriority}
          />
          {priorityConflict ? <FieldError message={priorityConflict} /> : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {capabilities.nextStatus ? (
            <Button onClick={handleAdvance} loading={advancing} disabled={Boolean(capabilities.nextStatusBlockedReason)}>
              {capabilities.nextStatusLabel}
            </Button>
          ) : null}
          {capabilities.canCancel ? (
            <Button variant="destructive" onClick={() => setCancelOpen(true)}>
              Cancelar pedido
            </Button>
          ) : null}
          {capabilities.nextStatusBlockedReason ? (
            <span className="text-body-sm text-muted-foreground">{capabilities.nextStatusBlockedReason}</span>
          ) : null}
        </div>
        {capabilities.cancelWarning ? (
          <p className="text-body-sm text-muted-foreground">{capabilities.cancelWarning}</p>
        ) : null}
        {advanceConflict ? <FieldError message={advanceConflict} /> : null}
      </div>

      <OrderShipmentModal
        order={order}
        mode="ship"
        open={shipmentModalOpen}
        onClose={() => setShipmentModalOpen(false)}
        onOrderUpdated={(next) => {
          onOrderUpdated(next);
          onOrderChanged();
        }}
        refreshOrder={refreshOrder}
      />

      <ConfirmModal
        open={cancelOpen}
        title="Cancelar pedido"
        confirmLabel="Cancelar pedido"
        cancelLabel="Volver"
        variant="destructive"
        loading={cancelling}
        error={cancelConflict}
        onCancel={() => {
          setCancelOpen(false);
          setCancelReason("");
        }}
        onConfirm={handleCancel}
      >
        <p className="text-body-sm text-muted-foreground-strong">
          El pedido {order.orderNumber} pasará a estatus cancelado. Esta acción no se puede deshacer.
        </p>
        <Textarea
          label="Motivo (opcional)"
          placeholder="La clienta pidió cancelar por cambio de dirección"
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
        />
      </ConfirmModal>
    </Card>
  );
}

export { OrderStatusBlock };
