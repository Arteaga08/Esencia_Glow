import type { Types } from "mongoose";
import type { PublicHomeContent, PublicHomeHeroSlide } from "@esencia-glow/shared";
import type { HomeContentAttrs } from "../models/home-content.model.js";
import { Category } from "../models/category.model.js";
import { Product } from "../models/product.model.js";
import { AppError } from "../utils/app-error.js";
import { logger } from "../config/logger.js";
import { buildPublicProductMatch } from "../utils/build-product-filter.js";
import { buildImageDto, buildPublicCategory, type LeanCategory, type LeanProduct } from "./catalog-dto.js";
import { buildPublicProductsWithRefs } from "./catalog-public.service.js";
import { readHomeContent } from "./home-content-store.js";

/**
 * Lectura pública del home (Milestone 1.8). Filtra AL SERVIR, nunca al
 * guardar: el documento conserva todo (secciones e ítems inactivos, productos
 * archivados que mañana pueden volver) y este archivo decide qué cruza al
 * storefront. Se omite:
 *   - una sección inactiva, o que quedó vacía tras filtrar;
 *   - ítems y slides inactivos;
 *   - slides sin imagen de escritorio (no se pueden publicar);
 *   - productos fuera de `buildPublicProductMatch` (borrador, archivado, canal
 *     suscripción, sin variantes activas) o borrados;
 *   - categorías inactivas o borradas.
 * Respeta el orden guardado. Nunca expone `version`, `isActive`, `updatedAt`
 * ni `publicId` de Cloudinary.
 *
 * Un GET nunca escribe: sin documento devuelve `{}`.
 */

/** Reordena `docs` según `orderedIds`, descartando los ids que ya no resuelven. */
function inSavedOrder<T extends { _id: Types.ObjectId }>(orderedIds: Types.ObjectId[], docs: T[]): T[] {
  const byId = new Map(docs.map((doc) => [doc._id.toString(), doc]));
  return orderedIds.flatMap((id) => byId.get(id.toString()) ?? []);
}

function buildAnnouncement(doc: HomeContentAttrs): PublicHomeContent["announcement"] {
  const section = doc.announcement;
  if (!section?.isActive || !section.text) return undefined;
  return { text: section.text, ...(section.href ? { href: section.href } : {}) };
}

function buildHero(doc: HomeContentAttrs): PublicHomeContent["hero"] {
  const section = doc.hero;
  if (!section?.isActive) return undefined;

  const slides = (section.slides ?? []).flatMap((slide): PublicHomeHeroSlide[] => {
    const desktop = buildImageDto(slide.images?.desktop);
    if (!slide.isActive || !desktop) return [];
    const mobile = buildImageDto(slide.images?.mobile);
    return [
      {
        id: slide._id.toString(),
        title: slide.title,
        ...(slide.subtitle ? { subtitle: slide.subtitle } : {}),
        ...(slide.ctaLabel ? { ctaLabel: slide.ctaLabel } : {}),
        ...(slide.ctaHref ? { ctaHref: slide.ctaHref } : {}),
        images: { desktop, ...(mobile ? { mobile } : {}) },
      },
    ];
  });

  return slides.length > 0 ? { slides } : undefined;
}

async function buildFeaturedProducts(doc: HomeContentAttrs): Promise<PublicHomeContent["featuredProducts"]> {
  const section = doc.featuredProducts;
  if (!section?.isActive || !section.productIds?.length) return undefined;

  const found = await Product.find(buildPublicProductMatch({ _id: { $in: section.productIds } })).lean<LeanProduct[]>();

  let products;
  try {
    products = await buildPublicProductsWithRefs(inSavedOrder(section.productIds, found));
  } catch (error) {
    // Un producto cuya categoría ya no existe (dato inconsistente) hace que el
    // helper del catálogo responda 404. En el home eso no puede tumbar la
    // página entera: se omite SOLO esta sección y se deja rastro. Cualquier
    // otro error (p. ej. la DB caída) sí se propaga.
    if (error instanceof AppError && error.statusCode === 404) {
      logger.warn({ err: error }, "Sección de productos destacados omitida: producto sin categoría resoluble");
      return undefined;
    }
    throw error;
  }

  return products.length > 0 ? { ...(section.title ? { title: section.title } : {}), products } : undefined;
}

async function buildFeaturedCategories(doc: HomeContentAttrs): Promise<PublicHomeContent["featuredCategories"]> {
  const section = doc.featuredCategories;
  if (!section?.isActive || !section.categoryIds?.length) return undefined;

  const found = await Category.find({ _id: { $in: section.categoryIds }, isActive: true }).lean<LeanCategory[]>();
  const categories = inSavedOrder(section.categoryIds, found).map(buildPublicCategory);

  return categories.length > 0 ? { ...(section.title ? { title: section.title } : {}), categories } : undefined;
}

function buildSubscriptionPromo(doc: HomeContentAttrs): PublicHomeContent["subscriptionPromo"] {
  const section = doc.subscriptionPromo;
  if (!section?.isActive || !section.title || !section.body) return undefined;
  const image = buildImageDto(section.image);
  return {
    title: section.title,
    body: section.body,
    ...(section.ctaLabel ? { ctaLabel: section.ctaLabel } : {}),
    ...(section.ctaHref ? { ctaHref: section.ctaHref } : {}),
    ...(image ? { image } : {}),
  };
}

function buildTestimonials(doc: HomeContentAttrs): PublicHomeContent["testimonials"] {
  const section = doc.testimonials;
  if (!section?.isActive) return undefined;
  const items = (section.items ?? [])
    .filter((item) => item.isActive)
    .map((item) => ({ id: item._id.toString(), author: item.author, quote: item.quote }));
  return items.length > 0 ? { items } : undefined;
}

function buildBenefits(doc: HomeContentAttrs): PublicHomeContent["benefits"] {
  const section = doc.benefits;
  if (!section?.isActive) return undefined;
  const items = (section.items ?? [])
    .filter((item) => item.isActive)
    .map((item) => ({
      id: item._id.toString(),
      icon: item.icon,
      title: item.title,
      ...(item.body ? { body: item.body } : {}),
    }));
  return items.length > 0 ? { items } : undefined;
}

async function getPublicHomeContent(): Promise<PublicHomeContent> {
  const doc = await readHomeContent();
  if (!doc) return {};

  const [featuredProducts, featuredCategories] = await Promise.all([
    buildFeaturedProducts(doc),
    buildFeaturedCategories(doc),
  ]);

  const candidates: PublicHomeContent = {
    announcement: buildAnnouncement(doc),
    hero: buildHero(doc),
    featuredProducts,
    featuredCategories,
    subscriptionPromo: buildSubscriptionPromo(doc),
    testimonials: buildTestimonials(doc),
    benefits: buildBenefits(doc),
  };

  // Sin claves `undefined`: el JSON las omite igual, pero así el objeto
  // devuelto es exactamente lo que se sirve.
  return Object.fromEntries(Object.entries(candidates).filter(([, value]) => value !== undefined));
}

export { getPublicHomeContent };
