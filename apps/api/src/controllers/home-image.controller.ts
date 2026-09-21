import type { Request, Response } from "express";
import { ContentAction, HomeSectionKey } from "@esencia-glow/shared";
import { asyncHandler } from "../utils/async-handler.js";
import { sendResponse } from "../utils/send-response.js";
import { AppError } from "../utils/app-error.js";
import * as homeImageService from "../services/home-image.service.js";
import { recordAudit } from "../services/audit.service.js";
import type { HeroImageSlot } from "../services/home-image.service.js";

type HeroImageParams = { slideId: string; slot: HeroImageSlot };

/**
 * `req.query` es de solo lectura en Express 5 y `validate` copia el valor
 * convertido en sitio: no se asume que `version` llegue ya como número. Joi ya
 * garantizó que es un entero >= 0, así que aquí solo se normaliza el tipo.
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
async function auditImageChange(req: Request, section: HomeSectionKey, version: number, slot?: HeroImageSlot) {
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

export { setHeroSlideImage, removeHeroSlideImage, setPromoImage, removePromoImage };
