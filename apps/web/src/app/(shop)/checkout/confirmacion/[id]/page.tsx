import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WarningCircle } from "@phosphor-icons/react/ssr";
import type { PublicOrder } from "@esencia-glow/shared";
import { SessionGate } from "@/components/storefront/account/session-gate";
import { OrderDone } from "@/components/storefront/checkout/order-done";
import { CTA_SECONDARY } from "@/components/storefront/cart/cta-styles";
import { fetchAccountData } from "@/lib/storefront/account-server";
import { getCustomerSession } from "@/lib/storefront/customer-session";

export const metadata: Metadata = {
  title: "Tu pedido | Esencia Glow",
  robots: { index: false, follow: false },
};

/**
 * Confirmación del pedido. Es también a donde vuelve la clienta de una
 * autenticación 3D Secure. Un pedido ajeno o inexistente es 404 (el API ya lo
 * filtra por dueña); sin sesión intenta el refresco silencioso.
 */
export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, order] = await Promise.all([getCustomerSession(), fetchAccountData<PublicOrder>(`/api/v1/orders/${encodeURIComponent(id)}`)]);

  if (!session || order.status === "unauthorized") return <SessionGate />;
  if (order.status === "notFound") notFound();

  if (order.status === "error") {
    return (
      <main className="pt-16 pb-32 xl:pt-20">
        <div className="mx-auto flex max-w-shell flex-col items-start gap-4 px-4 py-14 md:px-8 xl:px-12">
          {/* `FieldError` importa los íconos de cliente; en un Server Component se usa la variante `/ssr`. */}
          <p role="alert" className="flex items-start gap-1.5 text-body-sm text-destructive-action">
            <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            No pudimos cargar tu pedido en este momento. Si pagaste, no hagas nada más: te enviamos un correo con tu recibo.
          </p>
          <Link href="/mi-cuenta/pedidos" className={CTA_SECONDARY}>
            Ver mis pedidos
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pt-28 pb-32 md:px-8">
      <OrderDone order={order.data} firstName={session.user.firstName} email={session.user.email} />
    </main>
  );
}
