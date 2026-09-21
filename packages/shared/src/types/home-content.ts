import type { HomeBenefitIcon } from "../enums/home-benefit-icon.js";
import type { PublicCategory, PublicProduct, PublicProductImage } from "./catalog.js";

/**
 * Contrato del contenido del home (Milestone 1.8). Dos vistas del mismo
 * singleton:
 *
 * - `AdminHomeContent`: el documento completo, con TODAS las secciones (las
 *   nunca escritas llegan con `version: 0` e `isActive: false`), ítems
 *   inactivos incluidos y la `version` de cada sección — el editor la
 *   devuelve en cada escritura para el control optimista (409 si ya cambió).
 * - `PublicHomeContent`: lo que pinta el storefront. Se filtra AL SERVIR:
 *   una sección inactiva (o que quedó vacía tras filtrar) simplemente no
 *   viene; tampoco `version`, `isActive` ni ids de catálogo sin resolver.
 */
interface HomeSectionMeta {
  version: number;
  isActive: boolean;
  updatedAt?: string;
}

interface HomeHeroSlideImages<TDesktop = PublicProductImage | undefined> {
  desktop: TDesktop;
  mobile?: PublicProductImage;
}

interface AdminHomeAnnouncement extends HomeSectionMeta {
  text: string;
  href?: string;
}

interface AdminHomeHeroSlide {
  id: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  isActive: boolean;
  images: Partial<HomeHeroSlideImages>;
}

interface AdminHomeHero extends HomeSectionMeta {
  slides: AdminHomeHeroSlide[];
}

interface AdminHomeFeaturedProducts extends HomeSectionMeta {
  title?: string;
  productIds: string[];
}

interface AdminHomeFeaturedCategories extends HomeSectionMeta {
  title?: string;
  categoryIds: string[];
}

interface AdminHomeSubscriptionPromo extends HomeSectionMeta {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  image?: PublicProductImage;
}

interface AdminHomeTestimonial {
  id: string;
  author: string;
  quote: string;
  isActive: boolean;
}

interface AdminHomeTestimonials extends HomeSectionMeta {
  items: AdminHomeTestimonial[];
}

interface AdminHomeBenefit {
  id: string;
  icon: HomeBenefitIcon;
  title: string;
  body?: string;
  isActive: boolean;
}

interface AdminHomeBenefits extends HomeSectionMeta {
  items: AdminHomeBenefit[];
}

interface AdminHomeContent {
  announcement: AdminHomeAnnouncement;
  hero: AdminHomeHero;
  featuredProducts: AdminHomeFeaturedProducts;
  featuredCategories: AdminHomeFeaturedCategories;
  subscriptionPromo: AdminHomeSubscriptionPromo;
  testimonials: AdminHomeTestimonials;
  benefits: AdminHomeBenefits;
}

interface PublicHomeHeroSlide {
  id: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  /** Un slide sin imagen de escritorio no se publica — `desktop` siempre viene. */
  images: HomeHeroSlideImages<PublicProductImage>;
}

interface PublicHomeContent {
  announcement?: { text: string; href?: string };
  hero?: { slides: PublicHomeHeroSlide[] };
  featuredProducts?: { title?: string; products: PublicProduct[] };
  featuredCategories?: { title?: string; categories: PublicCategory[] };
  subscriptionPromo?: {
    title: string;
    body: string;
    ctaLabel?: string;
    ctaHref?: string;
    image?: PublicProductImage;
  };
  testimonials?: { items: Omit<AdminHomeTestimonial, "isActive">[] };
  benefits?: { items: Omit<AdminHomeBenefit, "isActive">[] };
}

export type {
  HomeSectionMeta,
  AdminHomeAnnouncement,
  AdminHomeHeroSlide,
  AdminHomeHero,
  AdminHomeFeaturedProducts,
  AdminHomeFeaturedCategories,
  AdminHomeSubscriptionPromo,
  AdminHomeTestimonial,
  AdminHomeTestimonials,
  AdminHomeBenefit,
  AdminHomeBenefits,
  AdminHomeContent,
  PublicHomeHeroSlide,
  PublicHomeContent,
};
