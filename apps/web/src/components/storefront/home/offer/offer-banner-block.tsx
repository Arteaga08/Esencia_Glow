import { getHomeContent } from "../../../../lib/storefront/home";
import { OfferBannerSection } from "./offer-banner-section";

/**
 * Bloque 8 del home: banner de oferta. Todo viene del panel (Contenido del
 * home). El API solo lo publica activo y completo (foto de escritorio, frase,
 * botón y enlace); sin eso, o si el API cae, no se pinta.
 */
async function OfferBannerBlock() {
  const home = await getHomeContent();
  if (!home?.offerBanner) return null;
  return <OfferBannerSection banner={home.offerBanner} />;
}

export { OfferBannerBlock };
