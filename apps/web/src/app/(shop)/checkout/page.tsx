import type { Metadata } from "next";
import { CheckoutView } from "@/components/storefront/checkout/checkout-view";
import { getCustomerSession } from "@/lib/storefront/customer-session";

export const metadata: Metadata = {
  title: "Finalizar compra | Esencia Glow",
  // Depende del carrito y de la cuenta de cada clienta: no hay nada que indexar.
  robots: { index: false, follow: false },
};

/**
 * `/checkout`. La cuenta es un paso DENTRO de la página, así que nunca redirige a
 * `/ingresar`: pasa lo que sabe de la sesión (o `null`) y el cliente decide.
 */
export default async function CheckoutPage() {
  const session = await getCustomerSession();
  return (
    <CheckoutView
      session={session ? { firstName: session.user.firstName, email: session.user.email, isCustomer: session.user.role === "customer" } : null}
    />
  );
}
