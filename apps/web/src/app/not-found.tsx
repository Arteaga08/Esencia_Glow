import type { Metadata } from "next";
import { SiteFooter } from "../components/storefront/layout/footer/site-footer";
import { SiteHeader } from "../components/storefront/layout/header/site-header";
import { NotFoundPage } from "../components/storefront/states/not-found-page";

export const metadata: Metadata = { title: "Página no encontrada | Esencia Glow", robots: { index: false } };

/**
 * 404 de toda la app. Next usa este archivo (no el del grupo `(shop)`) cuando
 * una URL no coincide con ninguna ruta, y también cuando `notFound()` se lanza
 * antes de que empiece el streaming; en ambos casos el layout de `(shop)` no se
 * monta, por eso aquí se incluyen el header y el footer de la tienda.
 */
export default function RootNotFound() {
  return (
    <>
      <SiteHeader />
      <NotFoundPage />
      <SiteFooter />
    </>
  );
}
