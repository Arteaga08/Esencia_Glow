import Joi from "joi";
import { HOME_CONTENT_LIMITS as LIMITS, HomeBenefitIcon } from "@esencia-glow/shared";

/**
 * Bodies de escritura del home (Milestone 1.8). Cada PUT reemplaza el
 * CONTENIDO de una sola sección y exige la `version` que el editor leyó
 * (control optimista, ver home-content-store.ts). Un campo opcional ausente
 * significa "quitarlo" — el PUT describe la sección completa, no un parche.
 *
 * `href`: solo ruta interna (`/algo`, nunca `//host`) o `https://`. El
 * `sanitizeInput` global escapa HTML pero no neutraliza `javascript:` dentro
 * de un href, que es justo lo que este patrón bloquea. El backslash se excluye
 * de la ruta: los navegadores lo normalizan a `/`, así que `/\\host` sería `//host`.
 */
const HREF_PATTERN = /^(?:\/(?![/\\])[^\s\\]*|https:\/\/[^\s]+)$/;

const hrefField = Joi.string().trim().max(LIMITS.hrefMax).pattern(HREF_PATTERN).messages({
  "string.pattern.base": "El enlace debe ser una ruta interna (/tienda) o una URL https://.",
});

const versionField = Joi.number().integer().min(0).required();
const objectId = Joi.string().hex().length(24);

/**
 * `unique("id")` de Joi trata dos items SIN id (ambos nuevos) como duplicados;
 * este comparador solo cuenta como repetido un id que sí venga.
 */
const uniqueDefinedIds = (a: { id?: string }, b: { id?: string }): boolean => a.id !== undefined && a.id === b.id;

/** Un id de item existente (edición) o ausente (item nuevo). */
const optionalItemId = objectId.messages({ "string.length": "Id inválido", "string.hex": "Id inválido" });

const updateAnnouncementSchema = Joi.object({
  version: versionField,
  isActive: Joi.boolean().required(),
  text: Joi.string().trim().min(1).max(LIMITS.announcementTextMax).required(),
  href: hrefField,
});

const heroSlideSchema = Joi.object({
  id: optionalItemId,
  title: Joi.string().trim().min(1).max(LIMITS.titleMax).required(),
  subtitle: Joi.string().trim().max(LIMITS.subtitleMax),
  ctaLabel: Joi.string().trim().max(LIMITS.ctaLabelMax),
  ctaHref: hrefField,
  isActive: Joi.boolean().required(),
}).and("ctaLabel", "ctaHref");

const updateHeroSchema = Joi.object({
  version: versionField,
  isActive: Joi.boolean().required(),
  slides: Joi.array().items(heroSlideSchema).max(LIMITS.maxHeroSlides).unique(uniqueDefinedIds).required(),
});

const updateFeaturedProductsSchema = Joi.object({
  version: versionField,
  isActive: Joi.boolean().required(),
  title: Joi.string().trim().max(LIMITS.titleMax),
  productIds: Joi.array().items(objectId.required()).max(LIMITS.maxFeaturedProducts).unique().required(),
});

const updateFeaturedCategoriesSchema = Joi.object({
  version: versionField,
  isActive: Joi.boolean().required(),
  title: Joi.string().trim().max(LIMITS.titleMax),
  categoryIds: Joi.array().items(objectId.required()).max(LIMITS.maxFeaturedCategories).unique().required(),
});

const updateSubscriptionPromoSchema = Joi.object({
  version: versionField,
  isActive: Joi.boolean().required(),
  title: Joi.string().trim().min(1).max(LIMITS.titleMax).required(),
  body: Joi.string().trim().min(1).max(LIMITS.bodyMax).required(),
  ctaLabel: Joi.string().trim().max(LIMITS.ctaLabelMax),
  ctaHref: hrefField,
}).and("ctaLabel", "ctaHref");

const testimonialItemSchema = Joi.object({
  id: optionalItemId,
  author: Joi.string().trim().min(1).max(LIMITS.authorMax).required(),
  quote: Joi.string().trim().min(1).max(LIMITS.quoteMax).required(),
  isActive: Joi.boolean().required(),
});

const updateTestimonialsSchema = Joi.object({
  version: versionField,
  isActive: Joi.boolean().required(),
  items: Joi.array().items(testimonialItemSchema).max(LIMITS.maxTestimonials).unique(uniqueDefinedIds).required(),
});

const benefitItemSchema = Joi.object({
  id: optionalItemId,
  icon: Joi.string()
    .valid(...Object.values(HomeBenefitIcon))
    .required(),
  title: Joi.string().trim().min(1).max(LIMITS.titleMax).required(),
  body: Joi.string().trim().max(LIMITS.bodyMax),
  isActive: Joi.boolean().required(),
});

const updateBenefitsSchema = Joi.object({
  version: versionField,
  isActive: Joi.boolean().required(),
  items: Joi.array().items(benefitItemSchema).max(LIMITS.maxBenefits).unique(uniqueDefinedIds).required(),
});

/** Params de las rutas de imagen del hero. */
const heroSlideImageParamsSchema = Joi.object({
  slideId: objectId.required().messages({ "string.length": "Id inválido", "string.hex": "Id inválido" }),
  slot: Joi.string().valid("desktop", "mobile").required(),
});

/** `version` viaja como campo de formulario (multipart) o en el body JSON (DELETE). */
const imageVersionBodySchema = Joi.object({
  version: Joi.number().integer().min(0).required(),
  alt: Joi.string().trim().max(200).allow(""),
});

const deleteImageQuerySchema = Joi.object({
  version: Joi.number().integer().min(0).required(),
});

export {
  updateAnnouncementSchema,
  updateHeroSchema,
  updateFeaturedProductsSchema,
  updateFeaturedCategoriesSchema,
  updateSubscriptionPromoSchema,
  updateTestimonialsSchema,
  updateBenefitsSchema,
  heroSlideImageParamsSchema,
  imageVersionBodySchema,
  deleteImageQuerySchema,
};
