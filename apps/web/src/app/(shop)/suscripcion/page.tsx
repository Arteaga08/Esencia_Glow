import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { StateView } from "@/components/storefront/states/state-view";

export const metadata: Metadata = buildPageMetadata({
  title: "Suscripción | Esencia Glow",
  description: "La caja de suscripción de Esencia Glow está en preparación.",
  path: "/suscripcion",
});

/**
 * Página pública de la suscripción. Mientras la suscripción no se venda, solo
 * avisa que se está armando; aquí irán el "cómo funciona" y los planes.
 */
export default function SubscriptionPage() {
  return <StateView kind="coming-soon" />;
}
