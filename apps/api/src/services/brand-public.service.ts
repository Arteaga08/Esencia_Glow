import type { PublicBrand } from "@esencia-glow/shared";
import { Brand } from "../models/brand.model.js";
import { AppError } from "../utils/app-error.js";
import { buildPublicBrand, type LeanBrand } from "./catalog-dto.js";

const COLLATION = { locale: "es", strength: 1 } as const;

type LeanSluggedBrand = LeanBrand & { slug: string };

/** Marcas que la clienta marcó "Mostrar en el home", en orden alfabético. */
async function listHomeBrands(): Promise<PublicBrand[]> {
  const brands = await Brand.find({ showOnHome: true, slug: { $type: "string" } })
    .collation(COLLATION)
    .sort({ name: 1 })
    .lean<LeanSluggedBrand[]>();
  return brands.map(buildPublicBrand);
}

/** Una marca por slug, para su página; sin importar si sale en el home. */
async function getPublicBrandBySlug(slug: string): Promise<PublicBrand> {
  const brand = await Brand.findOne({ slug }).lean<LeanSluggedBrand>();
  if (!brand) throw new AppError("Marca no encontrada", 404);
  return buildPublicBrand(brand);
}

export { listHomeBrands, getPublicBrandBySlug };
