"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { PublicOrder } from "@esencia-glow/shared";
import { FieldError } from "@/components/ui/field-error";
import { apiRequest } from "@/lib/api";
import { computeTotals, type CartLineView } from "@/lib/storefront/cart/cart-view";
import { clearCart } from "@/lib/storefront/cart/use-cart";
import { stepStatuses } from "@/lib/storefront/checkout/checkout-machine";
import { browserKeyStorage } from "@/lib/storefront/checkout/idempotency-key";
import { preparePayment, type PreparedPayment } from "@/lib/storefront/checkout/prepare-payment";
import { linesKeyOf, toOrderLines } from "@/lib/storefront/checkout/order-lines";
import { summarizeOrder } from "@/lib/storefront/checkout/order-summary";
import { placeOrder } from "@/lib/storefront/checkout/place-order";
import { useCoupon } from "@/lib/storefront/checkout/use-coupon";
import { useShippingSelection } from "@/lib/storefront/checkout/use-shipping-selection";
import { TEXT_LINK } from "../cart/cta-styles";
import { AccountStep } from "./account-step";
import { CheckoutLayout } from "./checkout-layout";
import { CouponField } from "./coupon-field";
import { PaymentStep } from "./payment-step";
import { ShippingStep } from "./shipping-step";
import { StepSection } from "./step-section";
import { AccountDone, ShippingDone } from "./step-summaries";

/** Un pedido ya creado desde esta página, con lo que hace falta para cobrarlo. */
interface PlacedOrder {
  order: PublicOrder;
  clientSecret: string;
  /** Llave del carrito al crearlo: mantiene montado el campo de tarjeta aunque el carrito ya se vació. */
  linesKey: string;
}

interface CheckoutFlowProps {
  customer: { firstName: string; email: string } | null;
  lines: CartLineView[];
  onRetryCart: () => void;
  placed: PlacedOrder | null;
  onPlaced: (placed: PlacedOrder) => void;
  /** El API dijo que ya hay un pedido pendiente: hay que reanudarlo. */
  onResume: () => void;
  onSessionLost: () => void;
}

/**
 * Checkout de una sola página (propuesta A): cuenta, envío y pago apilados, con
 * el resumen fijo a la derecha. El pedido se crea al pagar; en cuanto existe, el
 * carrito se vacía y la página sigue mostrando ESE pedido (con su total real).
 */
function CheckoutFlow({ customer, lines, onRetryCart, placed, onPlaced, onResume, onSessionLost }: CheckoutFlowProps) {
  const router = useRouter();
  const orderLines = useMemo(() => toOrderLines(lines), [lines]);
  const selection = useShippingSelection({ enabled: customer !== null, lines: orderLines });
  const [shippingNotice, setShippingNotice] = useState<string | null>(null);
  const coupon = useCoupon({ enabled: customer !== null && placed === null, lines: orderLines, onSessionLost });

  const statuses = stepStatuses({ signedIn: customer !== null, hasRate: placed !== null || selection.confirmed });
  const blocked = placed === null && lines.some((line) => !line.available);

  const cartTotals = {
    ...computeTotals(lines, selection.confirmed && selection.rate ? selection.rate.amountCents : null, coupon.applied?.discountCents ?? 0),
    ...(coupon.applied ? { couponCode: coupon.applied.code } : {}),
  };
  const summary = placed ? summarizeOrder(placed.order) : { lines, totals: cartTotals };
  const amountCents = summary.totals.totalCents;

  async function switchAccount() {
    try {
      await apiRequest("/api/v1/auth/logout", { method: "POST", authenticated: true });
    } catch {
      // Sin red igual se refresca: si la sesión sigue viva, el servidor lo dirá.
    }
    router.refresh();
  }

  function prepare(): Promise<PreparedPayment> {
    const quote = selection.quote;
    if (!placed && (!selection.rate || quote.status !== "ready")) return Promise.resolve({ ok: false, message: "Elige primero una opción de envío." });

    return preparePayment({
      placed: placed ? { orderId: placed.order.id, clientSecret: placed.clientSecret } : null,
      quoteId: quote.status === "ready" ? quote.quote.id : "",
      rateId: selection.rate?.rateId ?? "",
      lines: orderLines,
      couponCode: coupon.applied?.code,
      shownTotalCents: amountCents,
      placeOrder,
      storage: browserKeyStorage(),
      makeId: () => crypto.randomUUID(),
      onPlaced: (order, clientSecret) => onPlaced({ order, clientSecret, linesKey: linesKeyOf(orderLines) }),
      onCartSpent: clearCart,
      onResume,
      onRequote: (message) => {
        selection.restart();
        setShippingNotice(message);
      },
      onRetryCart,
      onSessionLost,
      onCouponRejected: coupon.reject,
    });
  }

  const shippingSelection = {
    ...selection,
    requestQuote: () => {
      setShippingNotice(null);
      selection.requestQuote();
    },
  };

  // Con el pedido ya creado el cupón ya se canjeó: el campo no se ofrece, el descuento va en los totales.
  const couponField =
    customer && !placed ? (
      <CouponField input={coupon.input} applied={coupon.applied} error={coupon.error} pending={coupon.pending} onInput={coupon.setInput} onApply={coupon.apply} onRemove={coupon.remove} />
    ) : undefined;

  return (
    <CheckoutLayout title="Finalizar compra" lines={summary.lines} totals={summary.totals} coupon={couponField}>
      {blocked ? (
        <div className="mb-6 flex flex-col items-start gap-1">
          <FieldError message="Algo de tu carrito se agotó. Quítalo para continuar con tu compra." />
          <Link href="/carrito" className={TEXT_LINK}>
            Ir a mi carrito
          </Link>
        </div>
      ) : null}

      <StepSection number={1} title="Cuenta" status={statuses.account} waiting="">
        {customer ? <AccountDone firstName={customer.firstName} email={customer.email} onSwitch={placed ? undefined : switchAccount} /> : <AccountStep />}
      </StepSection>

      <StepSection number={2} title="Envío" status={statuses.shipping} waiting="Disponible cuando inicies sesión.">
        {placed ? (
          <ShippingDone address={placed.order.shippingAddress} rate={placed.order.shippingSelection} />
        ) : selection.confirmed && selection.rate && selection.destination ? (
          <ShippingDone address={selection.destination} rate={selection.rate} onChange={selection.reopen} />
        ) : (
          <ShippingStep selection={shippingSelection} blocked={blocked} notice={shippingNotice} />
        )}
      </StepSection>

      <StepSection number={3} title="Pago" status={statuses.payment} waiting="Disponible cuando elijas el envío.">
        <PaymentStep amountCents={amountCents} requireTerms={placed === null} prepare={prepare} />
      </StepSection>
    </CheckoutLayout>
  );
}

export { CheckoutFlow };
export type { PlacedOrder };
