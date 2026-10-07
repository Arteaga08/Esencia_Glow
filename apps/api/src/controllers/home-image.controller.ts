import type { Request, Response } from "express";
import { ContentAction, HomeSectionKey } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { AppError } from "../utils/app-error.js";
import { SPOTLIGHT_BY_SLUG } from "../utils/home-spotlight.js";
import * as homeImageService from "../services/home-image.service.js";
import { recordAudit } from "../services/audit.service.js";
import type { HeroImageSlot, OfferBannerImageSlot } from "../services/home-image.service.js";

type HeroImageParams = { slideId: string; slot: HeroImageSlot };

/**
 * Joi ya garantizó que `version` es un entero >= 0; aquí solo se normaliza el
 * tipo por si el valor llegara sin convertir.
 */
function queryVersion(req: Request): number {
  return Number(req.query.version);
}

function requireFile(req: Request): Express.Multer.File {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) throw new AppError("Debes adjuntar una imagen", 400);
  return file;
}

/** Cada operación de imagen es una escritura de sección: una entrada de auditoría con `change: "image"`. */
async function auditImageChange(req: Request, section: HomeSectionKey, version: number, slot?: OfferBannerImageSlot) {
  await recordAudit({
    action: ContentAction.HOME_SECTION_UPDATED,
    actorId: req.user!.id,
    metadata: { section, version, change: "image", ...(slot ? { slot } : {}) },
  });
}

const setHeroSlideImage = asyncHandler(async (req: Request<HeroImageParams>, res: Response) => {
  const file = requireFile(req);
  const { version, alt } = req.body as { version: number; alt?: string };

  const hero = await homeImageService.setHeroSlideImage(
    req.params.slideId,
    req.params.slot,
    file.buffer,
    version,
    alt,
  );

  await auditImageChange(req, HomeSectionKey.HERO, hero.version, req.params.slot);
  sendResponse(res, 200, "Imagen del slide actualizada.", hero);
});

const removeHeroSlideImage = asyncHandler(async (req: Request<HeroImageParams>, res: Response) => {
  const version = queryVersion(req);

  const hero = await homeImageService.removeHeroSlideImage(req.params.slideId, req.params.slot, version);

  await auditImageChange(req, HomeSectionKey.HERO, hero.version, req.params.slot);
  sendResponse(res, 200, "Imagen del slide eliminada.", hero);
});

const setPromoImage = asyncHandler(async (req: Request, res: Response) => {
  const file = requireFile(req);
  const { version, alt } = req.body as { version: number; alt?: string };

  const promo = await homeImageService.setPromoImage(file.buffer, version, alt);

  await auditImageChange(req, HomeSectionKey.SUBSCRIPTION_PROMO, promo.version);
  sendResponse(res, 200, "Imagen de la promo actualizada.", promo);
});

const removePromoImage = asyncHandler(async (req: Request, res: Response) => {
  const version = queryVersion(req);

  const promo = await homeImageService.removePromoImage(version);

  await auditImageChange(req, HomeSectionKey.SUBSCRIPTION_PROMO, promo.version);
  sendResponse(res, 200, "Imagen de la promo eliminada.", promo);
});

type SpotlightImageParams = { section: string; slot: HeroImageSlot };

const setSpotlightImage = asyncHandler(async (req: Request<SpotlightImageParams>, res: Response) => {
  const file = requireFile(req);
  const { version, alt } = req.body as { version: number; alt?: string };
  const section = SPOTLIGHT_BY_SLUG[req.params.section]!;

  const result = await homeImageService.setSpotlightImage(section, req.params.slot, file.buffer, version, alt);

  await auditImageChange(req, section, result.version, req.params.slot);
  sendResponse(res, 200, "Foto del bloque actualizada.", result);
});

const removeSpotlightImage = asyncHandler(async (req: Request<SpotlightImageParams>, res: Response) => {
  const section = SPOTLIGHT_BY_SLUG[req.params.section]!;

  const result = await homeImageService.removeSpotlightImage(section, req.params.slot, queryVersion(req));

  await auditImageChange(req, section, result.version, req.params.slot);
  sendResponse(res, 200, "Foto del bloque eliminada.", result);
});

type SlotParams = { slot: OfferBannerImageSlot };

const setOfferBannerImage = asyncHandler(async (req: Request<SlotParams>, res: Response) => {
  const file = requireFile(req);
  const { version, alt } = req.body as { version: number; alt?: string };

  const result = await homeImageService.setOfferBannerImage(req.params.slot, file.buffer, version, alt);

  await auditImageChange(req, HomeSectionKey.OFFER_BANNER, result.version, req.params.slot);
  sendResponse(res, 200, "Foto del banner actualizada.", result);
});

const removeOfferBannerImage = asyncHandler(async (req: Request<SlotParams>, res: Response) => {
  const result = await homeImageService.removeOfferBannerImage(req.params.slot, queryVersion(req));

  await auditImageChange(req, HomeSectionKey.OFFER_BANNER, result.version, req.params.slot);
  sendResponse(res, 200, "Foto del banner eliminada.", result);
});

export {
  setOfferBannerImage,
  removeOfferBannerImage,
  setHeroSlideImage,
  removeHeroSlideImage,
  setPromoImage,
  removePromoImage,
  setSpotlightImage,
  removeSpotlightImage,
};
