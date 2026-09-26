"use client";

import { useState } from "react";
import { SHIPPING_CARRIER_LABELS, ShippingCarrier } from "@esencia-glow/shared";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";

const CARRIER_OPTIONS = Object.values(ShippingCarrier).map((value) => ({
  value,
  label: SHIPPING_CARRIER_LABELS[value],
}));

interface SubscriptionShipModalProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (input: { carrier: ShippingCarrier; trackingNumber: string }) => void;
}

/** La única transición que exige datos adicionales: el validator
 * (`subscription-shipment.validator.ts`) rechaza `shipped` sin paquetería
 * ni guía, así que se capturan aquí antes de mandar el PATCH. */
function SubscriptionShipModal({ open, loading, error, onCancel, onConfirm }: SubscriptionShipModalProps) {
  const [carrier, setCarrier] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");

  function handleSubmit() {
    if (!carrier || trackingNumber.trim().length < 3) return;
    onConfirm({ carrier: carrier as ShippingCarrier, trackingNumber: trackingNumber.trim() });
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Marcar como enviada"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={loading} disabled={!carrier || trackingNumber.trim().length < 3}>
            Marcar como enviada
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select label="Paquetería" value={carrier} onChange={setCarrier} options={CARRIER_OPTIONS} placeholder="Elige una paquetería" />
        <Input
          label="Número de guía"
          placeholder="PE-33210987"
          value={trackingNumber}
          onChange={(event) => setTrackingNumber(event.target.value)}
        />
        {error ? <FieldError message={error} /> : null}
      </div>
    </Modal>
  );
}

export { SubscriptionShipModal };
