import { Schema, type Types } from "mongoose";
import { HomeBenefitIcon } from "@esencia-glow/shared";
import { mediaImageSchema, type MediaImageAttrs } from "./media-image.schema.js";

/**
 * Subesquemas de las secciones del singleton `HomeContent` (Milestone 1.8).
 * Ninguno declara defaults: como en Settings, lo faltante se completa AL LEER
 * (`home-content-dto.ts`), nunca al escribir — un upsert jamás siembra
 * secciones que nadie editó, y `version` ausente significa "nunca escrita"
 * (el CAS de `home-content-store.ts` depende de eso).
 *
 * Los textos llevan los mismos topes que `HOME_CONTENT_LIMITS` (shared) como
 * red de seguridad; la validación de verdad vive en el validator Joi.
 */

/** Imagen embebida tal como la devuelve `.lean()`: `mediaImageSchema` lleva `_id`. */
type HomeImageAttrs = MediaImageAttrs & { _id: Types.ObjectId };

/** Campos comunes a toda sección: el control optimista y el interruptor. */
interface HomeSectionBaseAttrs {
  version?: number;
  isActive?: boolean;
  updatedAt?: Date;
}

interface HomeAnnouncementAttrs extends HomeSectionBaseAttrs {
  text?: string;
  href?: string;
}

interface HomeHeroSlideAttrs {
  _id: Types.ObjectId;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  isActive: boolean;
  images?: { desktop?: HomeImageAttrs; mobile?: HomeImageAttrs };
}

interface HomeHeroAttrs extends HomeSectionBaseAttrs {
  slides?: HomeHeroSlideAttrs[];
}

interface HomeFeaturedProductsAttrs extends HomeSectionBaseAttrs {
  title?: string;
  productIds?: Types.ObjectId[];
}

interface HomeFeaturedCategoriesAttrs extends HomeSectionBaseAttrs {
  title?: string;
  categoryIds?: Types.ObjectId[];
}

interface HomeSubscriptionPromoAttrs extends HomeSectionBaseAttrs {
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  image?: HomeImageAttrs;
}

interface HomeTestimonialAttrs {
  _id: Types.ObjectId;
  author: string;
  quote: string;
  isActive: boolean;
}

interface HomeTestimonialsAttrs extends HomeSectionBaseAttrs {
  items?: HomeTestimonialAttrs[];
}

interface HomeBenefitAttrs {
  _id: Types.ObjectId;
  icon: HomeBenefitIcon;
  title: string;
  body?: string;
  isActive: boolean;
}

interface HomeBenefitsAttrs extends HomeSectionBaseAttrs {
  items?: HomeBenefitAttrs[];
}

const baseFields = {
  version: { type: Number },
  isActive: { type: Boolean },
  updatedAt: { type: Date },
};

const announcementSchema = new Schema<HomeAnnouncementAttrs>(
  {
    ...baseFields,
    text: { type: String, trim: true, maxlength: 120 },
    href: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const heroSlideSchema = new Schema<HomeHeroSlideAttrs>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    subtitle: { type: String, trim: true, maxlength: 240 },
    ctaLabel: { type: String, trim: true, maxlength: 40 },
    ctaHref: { type: String, trim: true, maxlength: 500 },
    isActive: { type: Boolean, required: true },
    images: {
      type: new Schema({ desktop: { type: mediaImageSchema }, mobile: { type: mediaImageSchema } }, { _id: false }),
    },
  },
  { _id: true },
);

const heroSchema = new Schema<HomeHeroAttrs>(
  { ...baseFields, slides: { type: [heroSlideSchema] } },
  { _id: false },
);

const featuredProductsSchema = new Schema<HomeFeaturedProductsAttrs>(
  {
    ...baseFields,
    title: { type: String, trim: true, maxlength: 120 },
    productIds: { type: [{ type: Schema.Types.ObjectId, ref: "Product" }] },
  },
  { _id: false },
);

const featuredCategoriesSchema = new Schema<HomeFeaturedCategoriesAttrs>(
  {
    ...baseFields,
    title: { type: String, trim: true, maxlength: 120 },
    categoryIds: { type: [{ type: Schema.Types.ObjectId, ref: "Category" }] },
  },
  { _id: false },
);

const subscriptionPromoSchema = new Schema<HomeSubscriptionPromoAttrs>(
  {
    ...baseFields,
    title: { type: String, trim: true, maxlength: 120 },
    body: { type: String, trim: true, maxlength: 600 },
    ctaLabel: { type: String, trim: true, maxlength: 40 },
    ctaHref: { type: String, trim: true, maxlength: 500 },
    image: { type: mediaImageSchema },
  },
  { _id: false },
);

const testimonialSchema = new Schema<HomeTestimonialAttrs>(
  {
    author: { type: String, required: true, trim: true, maxlength: 80 },
    quote: { type: String, required: true, trim: true, maxlength: 500 },
    isActive: { type: Boolean, required: true },
  },
  { _id: true },
);

const testimonialsSchema = new Schema<HomeTestimonialsAttrs>(
  { ...baseFields, items: { type: [testimonialSchema] } },
  { _id: false },
);

const benefitSchema = new Schema<HomeBenefitAttrs>(
  {
    icon: { type: String, enum: Object.values(HomeBenefitIcon), required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, trim: true, maxlength: 600 },
    isActive: { type: Boolean, required: true },
  },
  { _id: true },
);

const benefitsSchema = new Schema<HomeBenefitsAttrs>(
  { ...baseFields, items: { type: [benefitSchema] } },
  { _id: false },
);

export {
  announcementSchema,
  heroSchema,
  featuredProductsSchema,
  featuredCategoriesSchema,
  subscriptionPromoSchema,
  testimonialsSchema,
  benefitsSchema,
};
export type {
  HomeImageAttrs,
  HomeSectionBaseAttrs,
  HomeAnnouncementAttrs,
  HomeHeroSlideAttrs,
  HomeHeroAttrs,
  HomeFeaturedProductsAttrs,
  HomeFeaturedCategoriesAttrs,
  HomeSubscriptionPromoAttrs,
  HomeTestimonialAttrs,
  HomeTestimonialsAttrs,
  HomeBenefitAttrs,
  HomeBenefitsAttrs,
};
