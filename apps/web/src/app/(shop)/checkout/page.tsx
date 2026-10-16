import type { Metadata } from "next";
import { CheckoutView } from "@/components/storefront/checkout/checkout-view";
import { SessionUnavailable } from "@/components/ui/session-unavailable";
import { getCustomerSession } from "@/lib/storefront/customer-session";

export const metadata: Metadata = {
  title: "Finalizar compra | Esencia Glow",
  // Depende del carrito y de la cuenta de cada clienta: no hay nada que indexar.
  robots: { index: false, follow: false },
};

/**
 * `/checkout`. La cuenta es un paso DENTRO de la página, así que nunca redirige a
 * `/ingresar`: pasa lo que sabe de la sesión (o `null`) y el cliente decide. Si
 * no se pudo confirmar (429, API caído) NO pasa `null`: el cliente le pediría
 * iniciar sesión a quien ya la tiene; se ofrece reintentar.
 */
export default async function CheckoutPage() {
  const state = await getCustomerSession();
  if (state.status === "unavailable") {
    return (
      <main className="mx-auto max-w-shell px-4 pt-28 pb-32 md:px-8">
        <SessionUnavailable />
      </main>
    );
  }
  const session = state.status === "authenticated" ? state.session : null;
  return (
    <CheckoutView
      session={session ? { firstName: session.user.firstName, email: session.user.email, isCustomer: session.user.role === "customer" } : null}
    />
  );
}
