"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { FieldError } from "@/components/ui/field-error";
import { apiRequest } from "@/lib/api";
import { computeTotals, type CartLineView } from "@/lib/storefront/cart/cart-view";
import { clearCart } from "@/lib/storefront/cart/use-cart";
import { mobileScreen, stepStatuses } from "@/lib/storefront/checkout/checkout-machine";
import { toOrderLines } from "@/lib/storefront/checkout/order-lines";
import { useCoupon } from "@/lib/storefront/checkout/use-coupon";
import { useDeliverySelection } from "@/lib/storefront/checkout/use-delivery-selection";
import { useStepFocus } from "@/lib/storefront/checkout/use-step-focus";
import { useStepHistory } from "@/lib/storefront/checkout/use-step-history";
import { buildWhatsappOrderMessage } from "@/lib/storefront/checkout/whatsapp-order-message";
import { whatsappHref } from "@/lib/storefront/contact";
import { deliveryShippingCents } from "@/lib/storefront/delivery";
import { TEXT_LINK } from "../cart/cta-styles";
import { AccountStep } from "./account-step";
import { CheckoutLayout } from "./checkout-layout";
import { SummaryBody } from "./checkout-summary";
import { CouponField } from "./coupon-field";
import { DeliveryStep } from "./delivery-step";
import { MobileStepHeader } from "./mobile-step-header";
import { StepSection } from "./step-section";
import { AccountDone, DeliveryDone } from "./step-summaries";
import { WhatsappSendStep } from "./whatsapp-send-step";

interface WhatsappCheckoutFlowProps {
  customer: { firstName: string; email: string } | null;
  lines: CartLineView[];
  onSessionLost: () => void;
}

const MOBILE_STEPS = {
  account: { number: 1, total: 3, title: "Cuenta" },
  address: { number: 2, total: 3, title: "Entrega" },
  payment: { number: 3, total: 3, title: "Enviar pedido" },
} as const;

/**
 * Checkout mientras los pedidos se cierran por WhatsApp (propuesta A, mismo
 * marco que el de tarjeta): cuenta, entrega y envío del mensaje. No crea ningún
 * pedido en el servidor ni aparta inventario; el total que se ve es el que viaja
 * escrito en el mensaje. En móvil, una pantalla por paso (reusa las de la tarjeta:
 * cuenta, "address" = entrega, "payment" = enviar).
 */
function WhatsappCheckoutFlow({ customer, lines, onSessionLost }: WhatsappCheckoutFlowProps) {
  const router = useRouter();
  const orderLines = useMemo(() => toOrderLines(lines), [lines]);
  const delivery = useDeliverySelection({ enabled: customer !== null });
  const coupon = useCoupon({ enabled: customer !== null, lines: orderLines, onSessionLost });

  const statuses = stepStatuses({ signedIn: customer !== null, hasRate: delivery.confirmed });
  const screen = mobileScreen({ signedIn: customer !== null, quoteReady: false, confirmed: delivery.confirmed });
  useStepFocus(screen, screen === "account" ? 1 : screen === "payment" ? 3 : 2);
  const goBack = screen === "payment" ? delivery.reopen : undefined;
  useStepHistory(screen, () => goBack?.());
  const blocked = lines.some((line) => !line.available);

  const shippingCents = delivery.method ? deliveryShippingCents(delivery.method) : null;
  const totals = {
    ...computeTotals(lines, shippingCents, coupon.applied?.discountCents ?? 0),
    ...(delivery.method === "national" ? { shippingNote: "Se acuerda por WhatsApp" } : {}),
    ...(coupon.applied ? { couponCode: coupon.applied.code } : {}),
  };

  async function switchAccount() {
    try {
      await apiRequest("/api/v1/auth/logout", { method: "POST", authenticated: true });
    } catch {
      // Sin red igual se refresca: si la sesión sigue viva, el servidor lo dirá.
    }
    router.refresh();
  }

  const profile = delivery.saved.status === "ready" ? delivery.saved.profile : null;
  const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : (customer?.firstName ?? "");
  const href =
    customer && delivery.method
      ? whatsappHref(buildWhatsappOrderMessage({ customer: { fullName, email: customer.email, phone: delivery.contactPhone }, lines, totals, delivery: delivery.method, address: delivery.address }))
      : "";

  const couponField = customer ? (
    <CouponField input={coupon.input} applied={coupon.applied} error={coupon.error} pending={coupon.pending} onInput={coupon.setInput} onApply={coupon.apply} onRemove={coupon.remove} />
  ) : undefined;

  return (
    <CheckoutLayout title="Finalizar pedido" lines={lines} totals={totals} coupon={couponField} hideMobileDisclosure={screen === "payment"}>
      {blocked ? (
        <div className="mb-6 flex flex-col items-start gap-1">
          <FieldError message="Algo de tu carrito se agotó. Quítalo para continuar con tu pedido." />
          <Link href="/carrito" className={TEXT_LINK}>
            Ir a mi carrito
          </Link>
        </div>
      ) : null}

      <MobileStepHeader screen={screen} steps={MOBILE_STEPS[screen === "rates" ? "address" : screen]} back={goBack ? { label: "Cambiar entrega", onClick: goBack } : undefined} />

      <StepSection number={1} title="Cuenta" status={statuses.account} waiting="" mobileHidden={screen !== "account" && screen !== "address"}>
        {customer ? <AccountDone firstName={customer.firstName} email={customer.email} onSwitch={switchAccount} /> : <AccountStep />}
      </StepSection>

      <StepSection number={2} title="Entrega" status={statuses.shipping} waiting="Disponible cuando inicies sesión." mobileHidden={screen === "account"}>
        {delivery.confirmed && delivery.method ? (
          <DeliveryDone method={delivery.method} address={delivery.address} phone={delivery.contactPhone} onChange={delivery.reopen} />
        ) : (
          <DeliveryStep selection={delivery} />
        )}
      </StepSection>

      {screen === "payment" ? (
        <section aria-label="Resumen de tu pedido" className="mb-4 rounded-md border border-border-strong bg-surface p-4 [--surface-bg:var(--color-surface)] lg:hidden">
          <h2 className="mb-4 type-shop-card-title text-foreground">Tu pedido</h2>
          <SummaryBody lines={lines} totals={totals} coupon={couponField} />
        </section>
      ) : null}

      <StepSection number={3} title="Enviar pedido" status={statuses.payment} waiting="Disponible cuando elijas la entrega." mobileHidden={screen !== "payment"}>
        {blocked ? <FieldError message="Quita lo que se agotó de tu carrito para enviar el pedido." /> : <WhatsappSendStep href={href} onClearCart={clearCart} />}
      </StepSection>
    </CheckoutLayout>
  );
}

export { WhatsappCheckoutFlow };
