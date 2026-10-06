"use client";

import { useMemo } from "react";
import type { PublicOrder } from "@esencia-glow/shared";
import { CancelOrderButton } from "@/components/storefront/account/sections/cancel-order-button";
import type { PreparedPayment } from "@/lib/storefront/checkout/prepare-payment";
import { resumeOrderPayment } from "@/lib/storefront/checkout/place-order";
import { summarizeOrder } from "@/lib/storefront/checkout/order-summary";
import { CheckoutLayout } from "./checkout-layout";
import { PaymentStep } from "./payment-step";
import { StepSection } from "./step-section";
import { ShippingDone } from "./step-summaries";

interface PendingOrderViewProps {
  order: PublicOrder;
  /** El pedido se canceló desde aquí: ya no hay nada que pagar. */
  onCancelled: () => void;
}

/**
 * Reanudar el pago de un pedido que ya existe (la clienta cerró la pestaña a
 * medias, o el pago fue rechazado). Muestra el pedido tal como se creó, no el
 * carrito: el servidor ya recalculó todo. Aceptar términos ya se hizo al crearlo.
 */
function PendingOrderView({ order, onCancelled }: PendingOrderViewProps) {
  const { lines, totals } = useMemo(() => summarizeOrder(order), [order]);

  async function prepare(): Promise<PreparedPayment> {
    const result = await resumeOrderPayment(order.id);
    if (result.ok) return { ok: true, clientSecret: result.clientSecret, orderId: order.id };
    return { ok: false, message: result.message, ...(result.settled ? { settledOrderId: order.id } : {}) };
  }

  return (
    <CheckoutLayout title="Termina de pagar tu pedido" lines={lines} totals={totals}>
      <p className="mb-6 max-w-[60ch] text-body text-foreground/80">
        Tu pedido <span className="font-mono">{order.orderNumber}</span> está apartado, solo falta el pago. Si ya no lo quieres, puedes cancelarlo.
      </p>

      <StepSection number={1} title="Envío" status="done" waiting="">
        <ShippingDone address={order.shippingAddress} rate={order.shippingSelection} />
      </StepSection>
      <StepSection number={2} title="Pago" status="active" waiting="">
        <PaymentStep amountCents={order.totals.totalCents} requireTerms={false} prepare={prepare} />
        <div className="mt-4">
          <CancelOrderButton orderId={order.id} onCancelled={onCancelled} />
        </div>
      </StepSection>
    </CheckoutLayout>
  );
}

export { PendingOrderView };
