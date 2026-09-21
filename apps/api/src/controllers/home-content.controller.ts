import type { Request, RequestHandler, Response } from "express";
import { ContentAction, HomeSectionKey, type HomeSectionMeta } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import * as homeContentService from "../services/home-content.service.js";
import { recordAudit } from "../services/audit.service.js";

const get = asyncHandler(async (_req: Request, res: Response) => {
  const home = await homeContentService.getAdminHomeContent();
  sendResponse(res, 200, "Contenido del home obtenido.", home);
});

/**
 * Fábrica de los 7 handlers de escritura: todos hacen lo mismo — llamar al
 * service de SU sección, dejar UNA entrada de auditoría que identifica la
 * sección (`metadata.section`, no solo "el home cambió") y responder con la
 * sección ya actualizada, con su nueva `version`.
 *
 * `TBody` se infiere del service de cada sección, así que un cambio de forma
 * en su input rompe la compilación en el call site (el body ya lo dejó
 * validado y tipado el validator Joi de esa ruta).
 *
 * La auditoría va después del write y solo si este tuvo éxito: un 409 por
 * versión vieja no deja entrada (no cambió nada).
 */
function sectionUpdateHandler<TBody, TSection extends HomeSectionMeta>(
  section: HomeSectionKey,
  message: string,
  update: (body: TBody) => Promise<TSection>,
  counts?: (result: TSection) => Record<string, number>,
): RequestHandler {
  return asyncHandler(async (req: Request, res: Response) => {
    const result = await update(req.body as TBody);

    await recordAudit({
      action: ContentAction.HOME_SECTION_UPDATED,
      actorId: req.user!.id,
      metadata: { section, version: result.version, change: "content", ...counts?.(result) },
    });

    sendResponse(res, 200, message, result);
  });
}

const updateAnnouncement = sectionUpdateHandler(
  HomeSectionKey.ANNOUNCEMENT,
  "Barra de anuncio actualizada.",
  homeContentService.updateAnnouncement,
);

const updateHero = sectionUpdateHandler(
  HomeSectionKey.HERO,
  "Hero actualizado.",
  homeContentService.updateHero,
  (hero) => ({ slides: hero.slides.length }),
);

const updateFeaturedProducts = sectionUpdateHandler(
  HomeSectionKey.FEATURED_PRODUCTS,
  "Productos destacados actualizados.",
  homeContentService.updateFeaturedProducts,
  (section) => ({ products: section.productIds.length }),
);

const updateFeaturedCategories = sectionUpdateHandler(
  HomeSectionKey.FEATURED_CATEGORIES,
  "Categorías destacadas actualizadas.",
  homeContentService.updateFeaturedCategories,
  (section) => ({ categories: section.categoryIds.length }),
);

const updateSubscriptionPromo = sectionUpdateHandler(
  HomeSectionKey.SUBSCRIPTION_PROMO,
  "Promo de suscripción actualizada.",
  homeContentService.updateSubscriptionPromo,
);

const updateTestimonials = sectionUpdateHandler(
  HomeSectionKey.TESTIMONIALS,
  "Testimonios actualizados.",
  homeContentService.updateTestimonials,
  (section) => ({ items: section.items.length }),
);

const updateBenefits = sectionUpdateHandler(
  HomeSectionKey.BENEFITS,
  "Beneficios actualizados.",
  homeContentService.updateBenefits,
  (section) => ({ items: section.items.length }),
);

export {
  get,
  updateAnnouncement,
  updateHero,
  updateFeaturedProducts,
  updateFeaturedCategories,
  updateSubscriptionPromo,
  updateTestimonials,
  updateBenefits,
};
