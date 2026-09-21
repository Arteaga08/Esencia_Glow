import type {
  AdminHomeAnnouncement,
  AdminHomeBenefits,
  AdminHomeContent,
  AdminHomeFeaturedCategories,
  AdminHomeFeaturedProducts,
  AdminHomeHero,
  AdminHomeSubscriptionPromo,
  AdminHomeTestimonials,
  HomeSectionMeta,
} from "@esencia-glow/shared";
import type { HomeContentAttrs } from "../models/home-content.model.js";
import type { HomeSectionBaseAttrs } from "../models/home-section.schemas.js";
import { buildImageDto } from "./catalog-dto.js";

/**
 * Vista admin del singleton: SIEMPRE las siete secciones. Una sección que
 * nadie ha escrito sale como `{version: 0, isActive: false, ...vacío}` — los
 * defaults se completan aquí, AL LEER, nunca al escribir (mismo criterio que
 * `getSettings`). El `version: 0` es lo que el editor devuelve en su primera
 * escritura y lo que el CAS de `home-content-store.ts` interpreta como
 * "la sección no existe".
 *
 * Nunca cruza `publicId`/`bytes`/`format` de Cloudinary (buildImageDto).
 */

function buildMeta(section?: HomeSectionBaseAttrs): HomeSectionMeta {
  return {
    version: section?.version ?? 0,
    isActive: section?.isActive ?? false,
    ...(section?.updatedAt ? { updatedAt: section.updatedAt.toISOString() } : {}),
  };
}

function buildAnnouncement(doc: HomeContentAttrs | null): AdminHomeAnnouncement {
  const section = doc?.announcement;
  return {
    ...buildMeta(section),
    text: section?.text ?? "",
    ...(section?.href ? { href: section.href } : {}),
  };
}

function buildHero(doc: HomeContentAttrs | null): AdminHomeHero {
  const section = doc?.hero;
  return {
    ...buildMeta(section),
    slides: (section?.slides ?? []).map((slide) => ({
      id: slide._id.toString(),
      title: slide.title,
      ...(slide.subtitle ? { subtitle: slide.subtitle } : {}),
      ...(slide.ctaLabel ? { ctaLabel: slide.ctaLabel } : {}),
      ...(slide.ctaHref ? { ctaHref: slide.ctaHref } : {}),
      isActive: slide.isActive,
      images: {
        ...(slide.images?.desktop ? { desktop: buildImageDto(slide.images.desktop) } : {}),
        ...(slide.images?.mobile ? { mobile: buildImageDto(slide.images.mobile) } : {}),
      },
    })),
  };
}

function buildFeaturedProducts(doc: HomeContentAttrs | null): AdminHomeFeaturedProducts {
  const section = doc?.featuredProducts;
  return {
    ...buildMeta(section),
    ...(section?.title ? { title: section.title } : {}),
    productIds: (section?.productIds ?? []).map((id) => id.toString()),
  };
}

function buildFeaturedCategories(doc: HomeContentAttrs | null): AdminHomeFeaturedCategories {
  const section = doc?.featuredCategories;
  return {
    ...buildMeta(section),
    ...(section?.title ? { title: section.title } : {}),
    categoryIds: (section?.categoryIds ?? []).map((id) => id.toString()),
  };
}

function buildSubscriptionPromo(doc: HomeContentAttrs | null): AdminHomeSubscriptionPromo {
  const section = doc?.subscriptionPromo;
  return {
    ...buildMeta(section),
    title: section?.title ?? "",
    body: section?.body ?? "",
    ...(section?.ctaLabel ? { ctaLabel: section.ctaLabel } : {}),
    ...(section?.ctaHref ? { ctaHref: section.ctaHref } : {}),
    ...(section?.image ? { image: buildImageDto(section.image) } : {}),
  };
}

function buildTestimonials(doc: HomeContentAttrs | null): AdminHomeTestimonials {
  const section = doc?.testimonials;
  return {
    ...buildMeta(section),
    items: (section?.items ?? []).map((item) => ({
      id: item._id.toString(),
      author: item.author,
      quote: item.quote,
      isActive: item.isActive,
    })),
  };
}

function buildBenefits(doc: HomeContentAttrs | null): AdminHomeBenefits {
  const section = doc?.benefits;
  return {
    ...buildMeta(section),
    items: (section?.items ?? []).map((item) => ({
      id: item._id.toString(),
      icon: item.icon,
      title: item.title,
      ...(item.body ? { body: item.body } : {}),
      isActive: item.isActive,
    })),
  };
}

function buildAdminHomeContent(doc: HomeContentAttrs | null): AdminHomeContent {
  return {
    announcement: buildAnnouncement(doc),
    hero: buildHero(doc),
    featuredProducts: buildFeaturedProducts(doc),
    featuredCategories: buildFeaturedCategories(doc),
    subscriptionPromo: buildSubscriptionPromo(doc),
    testimonials: buildTestimonials(doc),
    benefits: buildBenefits(doc),
  };
}

export {
  buildAdminHomeContent,
  buildAnnouncement,
  buildHero,
  buildFeaturedProducts,
  buildFeaturedCategories,
  buildSubscriptionPromo,
  buildTestimonials,
  buildBenefits,
};
