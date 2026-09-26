"use client";

import { useState, type FormEvent } from "react";
import { SHIPPING_CARRIER_LABELS, ShippingCarrier, OrderStatus, type AdminOrder } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { handleOrderError } from "./handle-order-error";

const CARRIER_OPTIONS = Object.values(ShippingCarrier).map((carrier) => ({
  value: carrier,
  label: SHIPPING_CARRIER_LABELS[carrier],
}));

type ShipmentModalMode = "ship" | "edit";

interface OrderShipmentModalProps {
  order: AdminOrder;
  mode: ShipmentModalMode;
  open: boolean;
  onClose: () => void;
  onOrderUpdated: (order: AdminOrder) => void;
  /** Relee el pedido tras un 409 (CAS perdido, guía ya generada, etc.) —
   * sin esto, `capabilities` sigue ofreciendo la acción que acaba de fallar. */
  refreshOrder: () => void;
}

/**
 * Un componente, dos modos, por el mismo `<form>` de guía en ambos casos:
 * `ship` dispara `PATCH /:id/status` con `{status:"shipped", shipment}` (el
 * validador exige `shipment` completo en esa transición); `edit` dispara
 * `PATCH /:id/shipment` (parche, `.min(1)`). En `ship`, si la guía ya está
 * `ready`, se prellena desde `order.label` — el sistema ya sabe el número.
 */
function OrderShipmentModal({ order, mode, open, onClose, onOrderUpdated, refreshOrder }: OrderShipmentModalProps) {
  const { toast } = useToast();
  const prefillFromLabel = mode === "ship" && order.label?.carrier && order.label.trackingNumber ? order.label : null;

  const [carrier, setCarrier] = useState<string | null>(
    prefillFromLabel?.carrier ?? order.shipment?.carrier ?? null,
  );
  const [trackingNumber, setTrackingNumber] = useState(
    prefillFromLabel?.trackingNumber ?? order.shipment?.trackingNumber ?? "",
  );
  const [carrierName, setCarrierName] = useState(order.shipment?.carrierName ?? "");
  const [trackingUrl, setTrackingUrl] = useState(order.shipment?.trackingUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    setConflict(null);

    const shipment = {
      carrier,
      trackingNumber: trackingNumber.trim(),
      ...(carrierName.trim() ? { carrierName: carrierName.trim() } : {}),
      ...(trackingUrl.trim() ? { trackingUrl: trackingUrl.trim() } : {}),
    };

    try {
      const response =
        mode === "ship"
          ? await apiRequest<AdminOrder>(`/api/v1/admin/orders/${order.id}/status`, {
              method: "PATCH",
              authenticated: true,
              body: { status: OrderStatus.SHIPPED, shipment },
            })
          : await apiRequest<AdminOrder>(`/api/v1/admin/orders/${order.id}/shipment`, {
              method: "PATCH",
              authenticated: true,
              body: shipment,
            });
      onOrderUpdated(response.data);
      toast({ variant: "success", title: mode === "ship" ? "Pedido marcado como enviado" : "Guía actualizada" });
      onClose();
    } catch (error) {
      handleOrderError({
        error,
        setFieldErrors: (errors) => setFieldErrors(errors),
        setConflict,
        toast,
        title: mode === "ship" ? "No se pudo marcar como enviado" : "No se pudo actualizar la guía",
        refresh: refreshOrder,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "ship" ? "Marcar como enviada" : "Corregir guía"}
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="order-shipment-form" loading={saving}>
            {mode === "ship" ? "Marcar como enviada" : "Guardar"}
          </Button>
        </>
      }
    >
      <form id="order-shipment-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          label="Paquetería"
          value={carrier}
          onChange={setCarrier}
          options={CARRIER_OPTIONS}
          placeholder="Estafeta"
          error={fieldErrors.carrier}
        />
        <Input
          label="Número de rastreo"
          placeholder="123456789012"
          value={trackingNumber}
          onChange={(event) => setTrackingNumber(event.target.value)}
          error={fieldErrors.trackingNumber}
          required
        />
        <Input
          label="Nombre de la paquetería (opcional)"
          placeholder="Estafeta Express"
          value={carrierName}
          onChange={(event) => setCarrierName(event.target.value)}
          error={fieldErrors.carrierName}
        />
        <Input
          label="URL de rastreo (opcional)"
          placeholder="https://rastreo.estafeta.com/123456789012"
          value={trackingUrl}
          onChange={(event) => setTrackingUrl(event.target.value)}
          error={fieldErrors.trackingUrl}
        />
        {conflict ? <p className="text-body-sm text-destructive-action">{conflict}</p> : null}
      </form>
    </Modal>
  );
}

export type { ShipmentModalMode };
export { OrderShipmentModal };
