"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderStatus, type PublicOrder } from "@esencia-glow/shared";
import { accountRequest } from "@/lib/storefront/account-api";
import { CTA_SECONDARY } from "../cart/cta-styles";

const POLL_EVERY_MS = 3000;
const MAX_ATTEMPTS = 10;

/**
 * La tarjeta ya se envió pero "pagado" lo decide el webhook de Stripe, que suele
 * llegar en segundos. Mientras tanto se vuelve a consultar el pedido; en cuanto
 * deja de estar pendiente se recarga la página con el resultado. Si tarda más de
 * lo normal, se dice y se deja el camino a Mis pedidos (el correo llega igual).
 */
function PaymentPendingWatch({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const timer = window.setInterval(async () => {
      attempts += 1;
      try {
        const response = await accountRequest<PublicOrder>(`/api/v1/orders/${orderId}`, { redirectOnFailure: false });
        if (cancelled) return;
        if (response.data.status !== OrderStatus.PENDING) {
          window.clearInterval(timer);
          router.refresh();
          return;
        }
      } catch {
        // Un tropiezo de red no cambia nada: se vuelve a intentar en el siguiente turno.
      }
      if (attempts >= MAX_ATTEMPTS && !cancelled) {
        window.clearInterval(timer);
        setGaveUp(true);
      }
    }, POLL_EVERY_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [orderId, router]);

  return (
    <div role="status" className="flex flex-col items-start gap-3">
      <p className="text-body text-foreground/80">
        {gaveUp ? "Tu banco aún no confirma el pago. No hagas nada más: en cuanto llegue te enviamos un correo y tu pedido pasa a preparación." : "Estamos confirmando tu pago con el banco. Esto toma unos segundos."}
      </p>
      {gaveUp ? (
        <Link href={`/mi-cuenta/pedidos/${orderId}`} className={CTA_SECONDARY}>
          Ver el estado de mi pedido
        </Link>
      ) : null}
    </div>
  );
}

export { PaymentPendingWatch };
