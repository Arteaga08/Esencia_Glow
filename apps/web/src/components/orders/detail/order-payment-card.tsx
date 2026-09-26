"use client";

import { useState } from "react";
import { DISPUTE_STATUS_LABELS, PAYMENT_METHOD_LABELS, type AdminOrder } from "@esencia-glow/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMoneyMXN } from "@/lib/format-money";
import { formatDateTime } from "@/lib/format-date";
import { DetailField } from "./detail-field";
import type { OrderCapabilities } from "./order-capabilities";
import { RefundModal } from "./refund-modal";

interface OrderPaymentCardProps {
  order: AdminOrder;
  capabilities: OrderCapabilities;
  onOrderUpdated: (order: AdminOrder) => void;
  onOrderChanged: () => void;
  refreshOrder: () => void;
}

function OrderPaymentCard({ order, capabilities, onOrderUpdated, onOrderChanged, refreshOrder }: OrderPaymentCardProps) {
  const [refundOpen, setRefundOpen] = useState(false);
  const payment = order.payment;

  return (
    <Card>
      <p className="mb-4 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">Pago</p>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DetailField label="Método">{PAYMENT_METHOD_LABELS[payment.method]}</DetailField>
        {payment.card ? (
          <DetailField label="Tarjeta" mono>
            {payment.card.brand} •••• {payment.card.last4}
          </DetailField>
        ) : null}
        {payment.capturedAt ? (
          <DetailField label="Cobrado el">{formatDateTime(payment.capturedAt)}</DetailField>
        ) : null}
        {payment.intentId ? (
          <DetailField label="Intent de Stripe" mono>
            {payment.intentId}
          </DetailField>
        ) : null}
        {payment.refundedAmountCents ? (
          <DetailField label="Reembolsado">{formatMoneyMXN(payment.refundedAmountCents)}</DetailField>
        ) : null}
        {payment.refundedAt ? <DetailField label="Reembolsado el">{formatDateTime(payment.refundedAt)}</DetailField> : null}
        {order.disputeStatus ? (
          <DetailField label="Contracargo">{DISPUTE_STATUS_LABELS[order.disputeStatus]}</DetailField>
        ) : null}
        {payment.lastError ? <DetailField label="Último error">{payment.lastError}</DetailField> : null}
      </dl>

      <div className="mt-4 flex flex-col gap-1.5">
        <Button variant="destructive" size="sm" onClick={() => setRefundOpen(true)} disabled={!capabilities.canRefund}>
          Reembolsar
        </Button>
        {capabilities.refundBlockedReason ? (
          <span className="text-body-sm text-muted-foreground">{capabilities.refundBlockedReason}</span>
        ) : null}
      </div>

      <RefundModal
        order={order}
        remainingCents={capabilities.remainingRefundCents}
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        onOrderUpdated={(next) => {
          onOrderUpdated(next);
          onOrderChanged();
        }}
        refreshOrder={refreshOrder}
      />
    </Card>
  );
}

export { OrderPaymentCard };
