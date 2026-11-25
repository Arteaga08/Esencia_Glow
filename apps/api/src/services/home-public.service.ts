import {
  HomeSectionKey,
  type HomePageCoverKey,
  type HomeSpotlightKey,
  type PublicHomeContent,
  type PublicHomeHeroSlide,
  type PublicHomeKits,
  type PublicHomeNewArrivals,
  type PublicHomeOfferBanner,
  type PublicProductImage,
  type PublicHomeSpotlight,
} from "@esencia-glow/shared";
import type { HomeContentAttrs } from "../models/home-content.model.js";
import { Category } from "../models/category.model.js";
import { Product } from "../models/product.model.js";
import { AppError } from "../utils/app-error.js";
import { logger } from "../config/logger.js";
import { buildPublicProductMatch } from "../utils/build-product-filter.js";
import { inSavedOrder } from "../utils/in-saved-order.js";
import { buildImageDto, buildPublicCategory, type LeanCategory, type LeanProduct } from "./catalog-dto.js";
import { buildPublicProductsWithRefs } from "./catalog-public.service.js";
import { readHomeContent } from "./home-content-store.js";
import { resolvePublicNewArrivals, resolvePublicKits } from "./home-spotlight-items.service.js";

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

/**
 * Un producto cuya categoría ya no existe (dato inconsistente) hace que el
 * helper del catálogo responda 404. En el home eso no puede tumbar la página
 * entera: se omite SOLO esa sección y se deja rastro. Cualquier otro error
 * (p. ej. la DB caída) sí se propaga.
 */
async function omitIfCategoryMissing<T>(build: () => Promise<T>, label: string): Promise<T | undefined> {
  try {
    return await build();
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      logger.warn({ err: error }, `Sección de ${label} omitida: producto sin categoría resoluble`);
      return undefined;
    }
    throw error;
  }
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

  const products = await omitIfCategoryMissing(
    () => buildPublicProductsWithRefs(inSavedOrder(section.productIds!, found)),
    "productos destacados",
  );
  if (!products) return undefined;

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

/** Novedades / Kits: sin foto de escritorio no se publica, igual que un slide del hero. */
function buildSpotlight(doc: HomeContentAttrs, key: HomeSpotlightKey): PublicHomeSpotlight | undefined {
  const section = doc[key];
  const desktop = buildImageDto(section?.images?.desktop);
  if (!section?.isActive || !section.title || !desktop) return undefined;
  const mobile = buildImageDto(section.images?.mobile);
  return {
    title: section.title,
    ...(section.subtitle ? { subtitle: section.subtitle } : {}),
    images: { desktop, ...(mobile ? { mobile } : {}) },
  };
}

/** Novedades: portada publicada más sus tarjetas; sin ninguna tarjeta posible no se publica. */
async function buildNewArrivals(doc: HomeContentAttrs): Promise<PublicHomeNewArrivals | undefined> {
  const cover = buildSpotlight(doc, HomeSectionKey.NEW_ARRIVALS);
  if (!cover) return undefined;
  const products = await omitIfCategoryMissing(
    () => resolvePublicNewArrivals(doc.newArrivals?.itemIds ?? []),
    "novedades",
  );
  return products && products.length > 0 ? { ...cover, products } : undefined;
}

/** Kits: portada publicada más sus paquetes; sin ninguno posible no se publica. */
async function buildKits(doc: HomeContentAttrs): Promise<PublicHomeKits | undefined> {
  const cover = buildSpotlight(doc, HomeSectionKey.KITS);
  if (!cover) return undefined;
  const bundles = await omitIfCategoryMissing(() => resolvePublicKits(doc.kits?.itemIds ?? []), "kits");
  return bundles && bundles.length > 0 ? { ...cover, bundles } : undefined;
}

/** Banner de oferta: sin foto de escritorio, frase, botón o enlace no se publica. */
function buildOfferBanner(doc: HomeContentAttrs): PublicHomeOfferBanner | undefined {
  const section = doc.offerBanner;
  const desktop = buildImageDto(section?.images?.desktop);
  if (!section?.isActive || !section.text || !section.ctaLabel || !section.ctaHref || !desktop) return undefined;
  const mobile = buildImageDto(section.images?.mobile);
  return {
    text: section.text,
    ctaLabel: section.ctaLabel,
    ctaHref: section.ctaHref,
    images: { desktop, ...(mobile ? { mobile } : {}) },
  };
}

/**
 * Foto del encabezado de /ofertas. Se guarda en la sección del banner de
 * oferta pero NO depende de su `isActive`: apagar el banner del home no debe
 * dejar sin foto la página de ofertas.
 */
function buildSalePage(doc: HomeContentAttrs): PublicHomeContent["salePage"] {
  const image = buildImageDto(doc.offerBanner?.images?.page);
  return image ? { image } : undefined;
}

/** Foto del encabezado de /kits o /mas-vendidos: se publica con solo existir. */
function buildPageCover(doc: HomeContentAttrs, page: HomePageCoverKey): { image: PublicProductImage } | undefined {
  const image = buildImageDto(doc.pageCovers?.images?.[page]);
  return image ? { image } : undefined;
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

  const [featuredProducts, featuredCategories, newArrivals, kits] = await Promise.all([
    buildFeaturedProducts(doc),
    buildFeaturedCategories(doc),
    buildNewArrivals(doc),
    buildKits(doc),
  ]);

  const candidates: PublicHomeContent = {
    announcement: buildAnnouncement(doc),
    hero: buildHero(doc),
    featuredProducts,
    featuredCategories,
    subscriptionPromo: buildSubscriptionPromo(doc),
    testimonials: buildTestimonials(doc),
    benefits: buildBenefits(doc),
    newArrivals,
    kits,
    offerBanner: buildOfferBanner(doc),
    salePage: buildSalePage(doc),
    kitsPage: buildPageCover(doc, "kits"),
    bestsellersPage: buildPageCover(doc, "bestsellers"),
  };

  // Sin claves `undefined`: el JSON las omite igual, pero así el objeto
  // devuelto es exactamente lo que se sirve.
  return Object.fromEntries(Object.entries(candidates).filter(([, value]) => value !== undefined));
}

export { getPublicHomeContent };
