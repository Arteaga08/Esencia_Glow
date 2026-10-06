import type { Metadata } from "next";
import { CartPageView } from "@/components/storefront/cart/cart-page-view";

export const metadata: Metadata = {
  title: "Tu carrito | Esencia Glow",
  // El contenido depende del navegador de cada clienta: no hay nada que indexar.
  robots: { index: false, follow: true },
};

export default function CartPage() {
  return <CartPageView />;
}
