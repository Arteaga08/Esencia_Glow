"use client";

import { useState, type FormEvent } from "react";
import { MEXICAN_STATES, type AdminOrder } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { handleOrderError } from "./handle-order-error";

const STATE_OPTIONS = MEXICAN_STATES.map((state) => ({ value: state, label: state }));

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
 * retipear el resto.
 */
function ShippingAddressModal({ order, open, onClose, onOrderUpdated, refreshOrder }: ShippingAddressModalProps) {
  const { toast } = useToast();
  const address = order.shippingAddress;

  const [fullName, setFullName] = useState(address.fullName);
  const [phone, setPhone] = useState(address.phone);
  const [street, setStreet] = useState(address.street);
  const [exteriorNumber, setExteriorNumber] = useState(address.exteriorNumber);
  const [interiorNumber, setInteriorNumber] = useState(address.interiorNumber ?? "");
  const [neighborhood, setNeighborhood] = useState(address.neighborhood);
  const [city, setCity] = useState(address.city);
  const [state, setState] = useState<string | null>(address.state);
  const [postalCode, setPostalCode] = useState(address.postalCode);
  const [references, setReferences] = useState(address.references ?? "");

  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    setConflict(null);
    try {
      const response = await apiRequest<AdminOrder>(`/api/v1/admin/orders/${order.id}/shipping-address`, {
        method: "PATCH",
        authenticated: true,
        body: {
          fullName: fullName.trim(),
          phone: phone.replace(/\D/g, ""),
          street: street.trim(),
          exteriorNumber: exteriorNumber.trim(),
          ...(interiorNumber.trim() ? { interiorNumber: interiorNumber.trim() } : {}),
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          state,
          postalCode: postalCode.trim(),
          ...(references.trim() ? { references: references.trim() } : {}),
        },
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
        <Input
          label="Nombre completo"
          placeholder="María López"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={fieldErrors.fullName}
          required
        />
        <Input
          label="Teléfono"
          placeholder="3312345678"
          inputMode="numeric"
          value={phone}
          onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
          error={fieldErrors.phone}
          maxLength={10}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Calle"
            placeholder="Av. Vallarta"
            value={street}
            onChange={(event) => setStreet(event.target.value)}
            error={fieldErrors.street}
            required
          />
          <Input
            label="Número exterior"
            placeholder="1234"
            value={exteriorNumber}
            onChange={(event) => setExteriorNumber(event.target.value)}
            error={fieldErrors.exteriorNumber}
            required
          />
        </div>
        <Input
          label="Número interior (opcional)"
          placeholder="Depto 4B"
          value={interiorNumber}
          onChange={(event) => setInteriorNumber(event.target.value)}
          error={fieldErrors.interiorNumber}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Colonia"
            placeholder="Americana"
            value={neighborhood}
            onChange={(event) => setNeighborhood(event.target.value)}
            error={fieldErrors.neighborhood}
            required
          />
          <Input
            label="Ciudad"
            placeholder="Guadalajara"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            error={fieldErrors.city}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Estado"
            value={state}
            onChange={setState}
            options={STATE_OPTIONS}
            placeholder="Jalisco"
            error={fieldErrors.state}
          />
          <Input
            label="Código postal"
            placeholder="44160"
            inputMode="numeric"
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, ""))}
            error={fieldErrors.postalCode}
            maxLength={5}
            required
          />
        </div>
        <Textarea
          label="Referencias (opcional)"
          placeholder="Casa azul, portón negro"
          value={references}
          onChange={(event) => setReferences(event.target.value)}
          error={fieldErrors.references}
        />
        {conflict ? <p className="text-body-sm text-destructive-action">{conflict}</p> : null}
      </form>
    </Modal>
  );
}

export { ShippingAddressModal };
