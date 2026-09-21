/**
 * Límites de forma del contenido del home (Milestone 1.8). Viven en `shared`
 * para que el editor del dashboard (2.7) valide con los mismos números que el
 * servidor. Son topes de forma, no de diseño: el layout real del M3 decide
 * cuántos pinta.
 */
const HOME_CONTENT_LIMITS = {
  maxHeroSlides: 5,
  maxFeaturedProducts: 12,
  maxFeaturedCategories: 8,
  maxTestimonials: 12,
  maxBenefits: 6,
  announcementTextMax: 120,
  titleMax: 120,
  subtitleMax: 240,
  ctaLabelMax: 40,
  hrefMax: 500,
  bodyMax: 600,
  authorMax: 80,
  quoteMax: 500,
} as const;

export { HOME_CONTENT_LIMITS };
