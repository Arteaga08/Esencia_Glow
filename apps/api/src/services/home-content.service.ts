import { Types } from "mongoose";
import {
  HomeSectionKey,
  type AdminHomeAnnouncement,
  type AdminHomeBenefits,
  type AdminHomeContent,
  type AdminHomeFeaturedCategories,
  type AdminHomeFeaturedProducts,
  type AdminHomeHero,
  type AdminHomeSubscriptionPromo,
  type AdminHomeTestimonials,
} from "@esencia-glow/shared";
import type { HomeHeroSlideAttrs } from "../models/home-section.schemas.js";
import { Category } from "../models/category.model.js";
import { Product } from "../models/product.model.js";
import { AppError } from "../utils/app-error.js";
import { assertVersionMatches, readHomeContent, writeSection, type SectionWrite } from "./home-content-store.js";
import {
  buildAdminHomeContent,
  buildAnnouncement,
  buildBenefits,
  buildFeaturedCategories,
  buildFeaturedProducts,
  buildHero,
  buildSubscriptionPromo,
  buildTestimonials,
} from "./home-content-dto.js";
import { destroyImageBestEffort } from "./upload.service.js";

/**
 * Escritura del contenido del home, UNA función por sección (Milestone 1.8).
 * Cada una arma un `SectionWrite` de su propia sección y lo entrega a
 * `writeSection` (CAS por versión). El PUT describe la sección completa: los
 * campos opcionales ausentes se quitan (`$unset`), no se conservan.
 *
 * No auditan: eso lo hace el controller, igual que en Settings.
 */

interface SectionInput {
  version: number;
  isActive: boolean;
}

/** `set` con los campos definidos y `unset` con los opcionales ausentes. */
function contentWrite(
  required: Record<string, unknown>,
  optional: Record<string, unknown | undefined>,
): SectionWrite {
  const set: Record<string, unknown> = { ...required };
  const unset: string[] = [];
  for (const [key, value] of Object.entries(optional)) {
    if (value === undefined) unset.push(key);
    else set[key] = value;
  }
  return { set, unset };
}

/** Objeto sin las claves `undefined` (para subdocumentos con campos opcionales). */
function definedOnly<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/**
 * Resuelve el id de cada ítem enviado: sin `id` es nuevo (id generado aquí),
 * con `id` debe existir ya en la sección leída a esa versión.
 */
function resolveItems<TInput extends { id?: string }, TExisting extends { _id: Types.ObjectId }>(
  inputItems: TInput[],
  existingItems: TExisting[] | undefined,
  label: string,
): { input: TInput; id: Types.ObjectId; existing?: TExisting }[] {
  const byId = new Map((existingItems ?? []).map((item) => [item._id.toString(), item]));
  return inputItems.map((input) => {
    if (!input.id) return { input, id: new Types.ObjectId() };
    const existing = byId.get(input.id);
    if (!existing) throw new AppError(`${label} desconocido: ${input.id}`, 400);
    return { input, id: existing._id, existing };
  });
}

async function assertAllExist(model: typeof Product | typeof Category, ids: string[], label: string): Promise<void> {
  if (ids.length === 0) return;
  const found = await model.countDocuments({ _id: { $in: ids } });
  if (found !== ids.length) throw new AppError(`Uno o más ${label} no existen.`, 400);
}

async function getAdminHomeContent(): Promise<AdminHomeContent> {
  return buildAdminHomeContent(await readHomeContent());
}

interface AnnouncementInput extends SectionInput {
  text: string;
  href?: string;
}

async function updateAnnouncement(input: AnnouncementInput): Promise<AdminHomeAnnouncement> {
  const doc = await writeSection(
    HomeSectionKey.ANNOUNCEMENT,
    input.version,
    contentWrite({ isActive: input.isActive, text: input.text }, { href: input.href }),
  );
  return buildAnnouncement(doc);
}

interface HeroSlideInput {
  id?: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  isActive: boolean;
}

interface HeroInput extends SectionInput {
  slides: HeroSlideInput[];
}

/**
 * Las imágenes NO viajan en este PUT: se conservan por `_id` de slide a
 * partir de lo leído a la misma versión (el CAS rechaza la escritura si la
 * sección cambió entre esa lectura y el write, así que no se pierde una
 * imagen subida en medio). Las imágenes de los slides quitados se borran de
 * Cloudinary DESPUÉS de persistir, best-effort.
 */
async function updateHero(input: HeroInput): Promise<AdminHomeHero> {
  const current = await readHomeContent();
  assertVersionMatches(current, HomeSectionKey.HERO, input.version);

  const resolved = resolveItems(input.slides, current?.hero?.slides, "Slide");
  const slides = resolved.map(({ input: slide, id, existing }) => ({
    _id: id,
    ...definedOnly({
      title: slide.title,
      subtitle: slide.subtitle,
      ctaLabel: slide.ctaLabel,
      ctaHref: slide.ctaHref,
      isActive: slide.isActive,
    }),
    images: existing?.images ?? {},
  }));

  const doc = await writeSection(
    HomeSectionKey.HERO,
    input.version,
    { set: { isActive: input.isActive, slides } },
  );

  const keptIds = new Set(resolved.map(({ id }) => id.toString()));
  const removed: HomeHeroSlideAttrs[] = (current?.hero?.slides ?? []).filter(
    (slide) => !keptIds.has(slide._id.toString()),
  );
  await Promise.all(
    removed.flatMap((slide) =>
      [slide.images?.desktop, slide.images?.mobile]
        .filter((image) => image !== undefined)
        .map((image) => destroyImageBestEffort(image.publicId)),
    ),
  );

  return buildHero(doc);
}

interface FeaturedProductsInput extends SectionInput {
  title?: string;
  productIds: string[];
}

async function updateFeaturedProducts(input: FeaturedProductsInput): Promise<AdminHomeFeaturedProducts> {
  await assertAllExist(Product, input.productIds, "productos");
  const doc = await writeSection(
    HomeSectionKey.FEATURED_PRODUCTS,
    input.version,
    contentWrite(
      { isActive: input.isActive, productIds: input.productIds.map((id) => new Types.ObjectId(id)) },
      { title: input.title },
    ),
  );
  return buildFeaturedProducts(doc);
}

interface FeaturedCategoriesInput extends SectionInput {
  title?: string;
  categoryIds: string[];
}

async function updateFeaturedCategories(input: FeaturedCategoriesInput): Promise<AdminHomeFeaturedCategories> {
  await assertAllExist(Category, input.categoryIds, "categorías");
  const doc = await writeSection(
    HomeSectionKey.FEATURED_CATEGORIES,
    input.version,
    contentWrite(
      { isActive: input.isActive, categoryIds: input.categoryIds.map((id) => new Types.ObjectId(id)) },
      { title: input.title },
    ),
  );
  return buildFeaturedCategories(doc);
}

interface SubscriptionPromoInput extends SectionInput {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
}

/** La imagen de la promo NO se toca aquí — tiene su propio endpoint. */
async function updateSubscriptionPromo(input: SubscriptionPromoInput): Promise<AdminHomeSubscriptionPromo> {
  const doc = await writeSection(
    HomeSectionKey.SUBSCRIPTION_PROMO,
    input.version,
    contentWrite(
      { isActive: input.isActive, title: input.title, body: input.body },
      { ctaLabel: input.ctaLabel, ctaHref: input.ctaHref },
    ),
  );
  return buildSubscriptionPromo(doc);
}

interface TestimonialInput {
  id?: string;
  author: string;
  quote: string;
  isActive: boolean;
}

interface TestimonialsInput extends SectionInput {
  items: TestimonialInput[];
}

async function updateTestimonials(input: TestimonialsInput): Promise<AdminHomeTestimonials> {
  const current = await readHomeContent();
  assertVersionMatches(current, HomeSectionKey.TESTIMONIALS, input.version);

  const items = resolveItems(input.items, current?.testimonials?.items, "Testimonio").map(({ input: item, id }) => ({
    _id: id,
    author: item.author,
    quote: item.quote,
    isActive: item.isActive,
  }));

  const doc = await writeSection(HomeSectionKey.TESTIMONIALS, input.version, {
    set: { isActive: input.isActive, items },
  });
  return buildTestimonials(doc);
}

interface BenefitInput {
  id?: string;
  icon: string;
  title: string;
  body?: string;
  isActive: boolean;
}

interface BenefitsInput extends SectionInput {
  items: BenefitInput[];
}

async function updateBenefits(input: BenefitsInput): Promise<AdminHomeBenefits> {
  const current = await readHomeContent();
  assertVersionMatches(current, HomeSectionKey.BENEFITS, input.version);

  const items = resolveItems(input.items, current?.benefits?.items, "Beneficio").map(({ input: item, id }) => ({
    _id: id,
    ...definedOnly({ icon: item.icon, title: item.title, body: item.body, isActive: item.isActive }),
  }));

  const doc = await writeSection(HomeSectionKey.BENEFITS, input.version, {
    set: { isActive: input.isActive, items },
  });
  return buildBenefits(doc);
}

export {
  getAdminHomeContent,
  updateAnnouncement,
  updateHero,
  updateFeaturedProducts,
  updateFeaturedCategories,
  updateSubscriptionPromo,
  updateTestimonials,
  updateBenefits,
};
