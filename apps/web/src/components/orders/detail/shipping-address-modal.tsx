"use client";

import { useState, type FormEvent } from "react";
import type { AdminOrder } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { AddressFields, addressFormToBody, addressToFormValue, type AddressFormValue } from "@/components/addresses/address-fields";
import { handleOrderError } from "./handle-order-error";

interface ShippingAddressModalProps {
  order: AdminOrder;
  open: boolean;
  onClose: () => void;
  onOrderUpdated: (order: AdminOrder) => void;
  refreshOrder: () => void;
}

/**
 * `PATCH /:id/shipping-address` es un REEMPLAZO completo, no un parche —
 * por eso el formulario viene prellenado con la dirección actual en vez de
 * pedir solo lo que cambia: corregir el número interior no debe obligar a
 * retipear el resto. Los campos son `AddressFields` (Milestone 2.8), que
 * este modal originó y ahora comparte con la dirección de origen de
 * Settings.
 */
function ShippingAddressModal({ order, open, onClose, onOrderUpdated, refreshOrder }: ShippingAddressModalProps) {
  const { toast } = useToast();
  const [value, setValue] = useState<AddressFormValue>(() => addressToFormValue(order.shippingAddress));

  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<string | null>(null);

  function handleChange(patch: Partial<AddressFormValue>) {
    setValue((current) => ({ ...current, ...patch }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    setConflict(null);
    try {
      const response = await apiRequest<AdminOrder>(`/api/v1/admin/orders/${order.id}/shipping-address`, {
        method: "PATCH",
        authenticated: true,
        body: addressFormToBody(value),
      });
      onOrderUpdated(response.data);
      toast({ variant: "success", title: "Dirección corregida" });
      onClose();
    } catch (error) {
      handleOrderError({
        error,
        setFieldErrors: (errors) => setFieldErrors(errors),
        setConflict,
        toast,
        title: "No se pudo corregir la dirección",
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
      title="Corregir dirección"
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form="shipping-address-form" loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="shipping-address-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AddressFields value={value} onChange={handleChange} errors={fieldErrors} />
        {conflict ? <p className="text-body-sm text-destructive-action">{conflict}</p> : null}
      </form>
    </Modal>
  );
}

export { ShippingAddressModal };
