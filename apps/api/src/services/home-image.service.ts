import { Types } from "mongoose";
import { HomeSectionKey, type AdminHomeHero, type AdminHomeSubscriptionPromo } from "@esencia-glow/shared";
import type { HomeContentAttrs } from "../models/home-content.model.js";
import type { HomeHeroSlideAttrs, HomeImageAttrs } from "../models/home-section.schemas.js";
import { AppError } from "../utils/app-error.js";
import { buildHero, buildSubscriptionPromo } from "./home-content-dto.js";
import { assertVersionMatches, readHomeContent, writeSection, type SectionWrite } from "./home-content-store.js";
import { destroyImageBestEffort, uploadImage } from "./upload.service.js";
import type { MediaAsset } from "./media-provider.js";

/**
 * Imágenes del home (Milestone 1.8): sub-recursos de SU sección — la imagen
 * de cada slide del hero (`desktop`/`mobile`) y la de la promo de suscripción.
 * Cada operación es una escritura de sección más: pide la `version` que el
 * editor leyó, la sube en +1 y deja su auditoría (la registra el controller).
 *
 * Flujo de subida (mismo patrón de compensación que catalog-image.service.ts,
 * pero con CAS en lugar de `save()`):
 *  1. Pre-chequeo barato SIN tocar el proveedor: versión (409) y existencia
 *     del slide / la sección (404). Una subida a un slide inexistente o a una
 *     versión vieja nunca cuesta un asset.
 *  2. Subida a Cloudinary.
 *  3. CAS. Si pierde (otro admin editó entre el pre-chequeo y aquí), se
 *     destruye lo recién subido y el 409 sube tal cual.
 *  4. Éxito: se borra la imagen anterior, best-effort.
 */

type HeroImageSlot = "desktop" | "mobile";

function toImageSubdocument(asset: MediaAsset, alt?: string) {
  return {
    _id: new Types.ObjectId(),
    url: asset.url,
    publicId: asset.publicId,
    width: asset.width,
    height: asset.height,
    format: asset.format,
    bytes: asset.bytes,
    ...(alt ? { alt } : {}),
  };
}

function findSlide(doc: HomeContentAttrs | null, slideId: string): HomeHeroSlideAttrs {
  const slide = doc?.hero?.slides?.find((candidate) => candidate._id.toString() === slideId);
  if (!slide) throw new AppError("Slide no encontrado", 404);
  return slide;
}

function requirePromo(doc: HomeContentAttrs | null): NonNullable<HomeContentAttrs["subscriptionPromo"]> {
  const promo = doc?.subscriptionPromo;
  if (!promo) throw new AppError("Primero guarda el contenido de la promo de suscripción", 404);
  return promo;
}

/** Sube, escribe con CAS y, si el write falla, deshace la subida. */
async function uploadAndWrite(
  buffer: Buffer,
  alt: string | undefined,
  section: HomeSectionKey,
  version: number,
  buildWrite: (image: ReturnType<typeof toImageSubdocument>) => SectionWrite,
): Promise<HomeContentAttrs> {
  const asset = await uploadImage({ buffer, folder: "home" });
  try {
    return await writeSection(section, version, buildWrite(toImageSubdocument(asset, alt)));
  } catch (error) {
    await destroyImageBestEffort(asset.publicId);
    throw error;
  }
}

async function setHeroSlideImage(
  slideId: string,
  slot: HeroImageSlot,
  buffer: Buffer,
  version: number,
  alt?: string,
): Promise<AdminHomeHero> {
  const current = await readHomeContent();
  assertVersionMatches(current, HomeSectionKey.HERO, version);
  const slide = findSlide(current, slideId);
  const previous: HomeImageAttrs | undefined = slide.images?.[slot];

  const doc = await uploadAndWrite(buffer, alt, HomeSectionKey.HERO, version, (image) => ({
    set: { [`slides.$[slide].images.${slot}`]: image },
    arrayFilters: [{ "slide._id": slide._id }],
  }));

  if (previous) await destroyImageBestEffort(previous.publicId);
  return buildHero(doc);
}

async function removeHeroSlideImage(slideId: string, slot: HeroImageSlot, version: number): Promise<AdminHomeHero> {
  const current = await readHomeContent();
  assertVersionMatches(current, HomeSectionKey.HERO, version);
  const previous = findSlide(current, slideId).images?.[slot];
  if (!previous) throw new AppError("Imagen no encontrada", 404);

  const doc = await writeSection(HomeSectionKey.HERO, version, {
    unset: [`slides.$[slide].images.${slot}`],
    arrayFilters: [{ "slide._id": new Types.ObjectId(slideId) }],
  });

  await destroyImageBestEffort(previous.publicId);
  return buildHero(doc);
}

async function setPromoImage(buffer: Buffer, version: number, alt?: string): Promise<AdminHomeSubscriptionPromo> {
  const current = await readHomeContent();
  assertVersionMatches(current, HomeSectionKey.SUBSCRIPTION_PROMO, version);
  const previous = requirePromo(current).image;

  const doc = await uploadAndWrite(buffer, alt, HomeSectionKey.SUBSCRIPTION_PROMO, version, (image) => ({
    set: { image },
  }));

  if (previous) await destroyImageBestEffort(previous.publicId);
  return buildSubscriptionPromo(doc);
}

async function removePromoImage(version: number): Promise<AdminHomeSubscriptionPromo> {
  const current = await readHomeContent();
  assertVersionMatches(current, HomeSectionKey.SUBSCRIPTION_PROMO, version);
  const previous = requirePromo(current).image;
  if (!previous) throw new AppError("Imagen no encontrada", 404);

  const doc = await writeSection(HomeSectionKey.SUBSCRIPTION_PROMO, version, { unset: ["image"] });

  await destroyImageBestEffort(previous.publicId);
  return buildSubscriptionPromo(doc);
}

export { setHeroSlideImage, removeHeroSlideImage, setPromoImage, removePromoImage };
export type { HeroImageSlot };
