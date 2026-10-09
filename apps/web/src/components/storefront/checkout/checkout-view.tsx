"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StaffAccountNotice } from "@/components/storefront/account/auth/staff-account-notice";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api";
import { useCart } from "@/lib/storefront/cart/use-cart";
import { useResolvedCart } from "@/lib/storefront/cart/use-resolved-cart";
import { CHECKOUT_MODE } from "@/lib/storefront/checkout/checkout-mode";
import { linesKeyOf, toOrderLines } from "@/lib/storefront/checkout/order-lines";
import { usePendingOrder } from "@/lib/storefront/checkout/use-pending-order";
import { useSessionCheck } from "@/lib/storefront/checkout/use-session-check";
import { CartEmpty } from "../cart/cart-empty";
import { TEXT_LINK } from "../cart/cta-styles";
import { CheckoutFlow, type PlacedOrder } from "./checkout-flow";
import { PendingOrderView } from "./pending-order-view";
import { WhatsappCheckoutFlow } from "./whatsapp-checkout-flow";

/** Lo que la página del servidor sabe de la sesión (nada de ella es secreto). */
interface CheckoutSession {
  firstName: string;
  email: string;
  isCustomer: boolean;
}

function CheckoutSkeleton() {
  return (
    <main className="pt-16 pb-32 xl:pt-20" aria-busy="true">
      <div className="mx-auto grid max-w-shell gap-12 px-4 py-14 md:px-8 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16 xl:px-12">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-12 w-72" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="hidden h-72 w-full lg:block" />
      </div>
    </main>
  );
}

/**
 * `/checkout`: decide qué mostrar. Sin carrito ni pedido pendiente no hay nada
 * que pagar; con un pedido pendiente (cerró la pestaña a medias, o un pago
 * rechazado) se reanuda ESE pedido en vez de crear otro; si no, el flujo normal.
 */
function CheckoutView({ session }: { session: CheckoutSession | null }) {
  const router = useRouter();
  const { lines: stored, hydrated } = useCart();
  const resolved = useResolvedCart(stored, hydrated);
  const sessionKnown = useSessionCheck(session !== null);

  const customer = session?.isCustomer ? session : null;
  const [pendingVersion, setPendingVersion] = useState(0);
  // En modo WhatsApp no existen pedidos pendientes de pago: no se consulta.
  const pending = usePendingOrder(customer !== null && CHECKOUT_MODE === "stripe", pendingVersion);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const linesKey = linesKeyOf(toOrderLines(resolved.lines));

  async function leaveStaffAccount() {
    try {
      await apiRequest("/api/v1/auth/logout", { method: "POST", authenticated: true });
    } catch {
      // Ver `switchAccount` en el flujo.
    }
    router.refresh();
  }

  if (session && !session.isCustomer) {
    return (
      <main className="pt-16 pb-32 xl:pt-20">
        <div className="mx-auto max-w-shell px-4 py-14 md:px-8 xl:px-12">
          <StaffAccountNotice onBack={leaveStaffAccount} />
        </div>
      </main>
    );
  }

  if (!hydrated || !sessionKnown) return <CheckoutSkeleton />;

  const whatsapp = CHECKOUT_MODE === "whatsapp";
  const flow = (key: string) =>
    whatsapp ? (
      <WhatsappCheckoutFlow key={key} customer={customer} lines={resolved.lines} onSessionLost={() => router.refresh()} />
    ) : (
    <CheckoutFlow
      key={key}
      customer={customer}
      lines={resolved.lines}
      onRetryCart={resolved.retry}
      placed={placed}
      onPlaced={setPlaced}
      onResume={() => {
        setDismissed(false);
        setPendingVersion((current) => current + 1);
      }}
      onSessionLost={() => router.refresh()}
    />
    );

  // Con un pedido recién creado la página sigue en el flujo (el campo de tarjeta ya tiene los datos).
  if (placed) return flow(placed.linesKey);

  if (customer && pending.status === "loading") return <CheckoutSkeleton />;
  if (customer && pending.status === "found" && !dismissed) {
    return <PendingOrderView order={pending.order} onCancelled={() => setDismissed(true)} />;
  }

  if (resolved.lines.length === 0) {
    return (
      <main className="pt-16 pb-32 xl:pt-20">
        <div className="mx-auto max-w-shell px-4 py-10 md:px-8 md:py-14 xl:px-12">
          <h1 className="text-page-title text-foreground md:text-display">Finalizar compra</h1>
          <CartEmpty className="mt-6" />
          <Link href="/carrito" className={`${TEXT_LINK} mx-auto`}>
            Ir a mi carrito
          </Link>
        </div>
      </main>
    );
  }

  return flow(linesKey);
}

export { CheckoutView };
export type { CheckoutSession };
