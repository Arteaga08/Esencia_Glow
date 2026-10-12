/**
 * Secciones del singleton de contenido del home (Milestone 1.8). El valor es
 * la clave literal del documento en Mongo (camelCase) y el `metadata.section`
 * de la auditoría; la ruta HTTP usa su propio slug kebab-case
 * (admin-home.routes.ts). Sumar una sección nueva es aditivo: un valor aquí,
 * su subesquema y su endpoint — ninguna sección existente se toca.
 */
enum HomeSectionKey {
  ANNOUNCEMENT = "announcement",
  HERO = "hero",
  FEATURED_PRODUCTS = "featuredProducts",
  FEATURED_CATEGORIES = "featuredCategories",
  SUBSCRIPTION_PROMO = "subscriptionPromo",
  TESTIMONIALS = "testimonials",
  BENEFITS = "benefits",
  NEW_ARRIVALS = "newArrivals",
  KITS = "kits",
  OFFER_BANNER = "offerBanner",
  PAGE_COVERS = "pageCovers",
}

/** Las dos secciones con forma de "portada + tarjetas del catálogo" (bloque 5 del home). */
type HomeSpotlightKey = HomeSectionKey.NEW_ARRIVALS | HomeSectionKey.KITS;

/** Páginas de listado de la tienda cuya foto de encabezado se carga en `pageCovers`. */
type HomePageCoverKey = "kits" | "bestsellers";

export { HomeSectionKey };
export type { HomeSpotlightKey, HomePageCoverKey };
