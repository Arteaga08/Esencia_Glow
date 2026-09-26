"use client";

import { useState } from "react";
import { SHIPPING_CARRIER_LABELS, type AdminOrder } from "@esencia-glow/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format-date";
import { formatMoneyMXN } from "@/lib/format-money";
import { DetailField } from "./detail-field";
import type { OrderCapabilities } from "./order-capabilities";
import { OrderLabelPanel } from "./order-label-panel";
import { OrderShipmentModal } from "./order-shipment-modal";
import { ShippingAddressModal } from "./shipping-address-modal";

interface OrderShippingCardProps {
  order: AdminOrder;
  capabilities: OrderCapabilities;
  onOrderUpdated: (order: AdminOrder) => void;
  onOrderChanged: () => void;
  refreshOrder: () => void;
}

function OrderShippingCard({ order, capabilities, onOrderUpdated, onOrderChanged, refreshOrder }: OrderShippingCardProps) {
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editShipmentOpen, setEditShipmentOpen] = useState(false);
  const address = order.shippingAddress;

  function handleUpdated(next: AdminOrder) {
    onOrderUpdated(next);
    onOrderChanged();
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">Envío</p>
        <div className="flex flex-col items-end gap-1">
          <Button size="sm" variant="secondary" onClick={() => setAddressModalOpen(true)} disabled={!capabilities.canEditAddress}>
            Corregir dirección
          </Button>
          {capabilities.addressBlockedReason ? (
            <span className="text-body-sm text-muted-foreground">{capabilities.addressBlockedReason}</span>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DetailField label="Destinatario">{address.fullName}</DetailField>
        <DetailField label="Teléfono" mono>
          {address.phone}
        </DetailField>
        <DetailField label="Dirección">
          {address.street} {address.exteriorNumber}
          {address.interiorNumber ? `, int. ${address.interiorNumber}` : ""}, {address.neighborhood}, {address.city},{" "}
          {address.state}, CP {address.postalCode}
        </DetailField>
        {address.references ? <DetailField label="Referencias">{address.references}</DetailField> : null}
        <DetailField label="Cotización">
          {SHIPPING_CARRIER_LABELS[order.shippingSelection.carrier]} · {order.shippingSelection.service} ·{" "}
          {formatMoneyMXN(order.shippingSelection.amountCents)} · {order.shippingSelection.estimatedDays} días
        </DetailField>
        <DetailField label="Paquete" mono>
          {order.parcel.weightGrams}g · {order.parcel.lengthCm}×{order.parcel.widthCm}×{order.parcel.heightCm}cm
        </DetailField>
      </dl>

      {order.shipment ? (
        <div className="mt-4 flex items-start justify-between gap-4 border-t border-border pt-4">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <DetailField label="Guía enviada" mono>
              {SHIPPING_CARRIER_LABELS[order.shipment.carrier]} · {order.shipment.trackingNumber}
            </DetailField>
            <DetailField label="Enviado el">{formatDateTime(order.shipment.shippedAt)}</DetailField>
          </dl>
          <Button size="sm" variant="secondary" onClick={() => setEditShipmentOpen(true)} disabled={!capabilities.canEditShipment}>
            Editar guía
          </Button>
        </div>
      ) : null}

      <OrderLabelPanel order={order} capabilities={capabilities} onOrderUpdated={handleUpdated} refreshOrder={refreshOrder} />

      <ShippingAddressModal
        order={order}
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        onOrderUpdated={handleUpdated}
        refreshOrder={refreshOrder}
      />
      <OrderShipmentModal
        order={order}
        mode="edit"
        open={editShipmentOpen}
        onClose={() => setEditShipmentOpen(false)}
        onOrderUpdated={handleUpdated}
        refreshOrder={refreshOrder}
      />
    </Card>
  );
}

export { OrderShippingCard };
