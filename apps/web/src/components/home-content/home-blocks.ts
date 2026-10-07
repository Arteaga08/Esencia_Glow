import { HOME_CONTENT_LIMITS, type AdminHomeContent } from "@esencia-glow/shared";

type HomeBlockId = "hero" | "newArrivals" | "kits" | "offerBanner";

interface HomeBlockSummary {
  id: HomeBlockId;
  name: string;
  description: string;
  isActive: boolean;
  /** Una línea con lo que hay hoy en el bloque, derivada del contenido guardado. */
  summary: string;
  /** Motivo por el que, estando activo, la tienda no lo publica; `null` si todo en orden. */
  issue: string | null;
  thumbnailUrl: string | null;
}

/** Orden en que los bloques aparecen en la tienda, de arriba hacia abajo. */
const HOME_BLOCK_ORDER: HomeBlockId[] = ["hero", "newArrivals", "kits", "offerBanner"];

const NO_DESKTOP_IMAGE = "Sin foto de escritorio";

function describeHomeBlocks(content: AdminHomeContent): HomeBlockSummary[] {
  const slides = content.hero.slides;
  const heroCount = slides.length;

  const byId: Record<HomeBlockId, HomeBlockSummary> = {
    hero: {
      id: "hero",
      name: "Hero",
      description: `La portada de la tienda. Hasta ${HOME_CONTENT_LIMITS.maxHeroSlides} slides que cambian solos.`,
      isActive: content.hero.isActive,
      summary: heroCount === 0 ? "Sin slides todavía" : `${heroCount} ${heroCount === 1 ? "slide" : "slides"}`,
      issue: heroCount === 0 ? "Sin slides" : null,
      thumbnailUrl: slides[0]?.images.desktop?.url ?? null,
    },
    newArrivals: {
      id: "newArrivals",
      name: "Novedades",
      description: "Portada del bloque de productos nuevos. Las tarjetas salen del catálogo.",
      isActive: content.newArrivals.isActive,
      summary: content.newArrivals.title || "Sin título todavía",
      issue: content.newArrivals.images.desktop ? null : NO_DESKTOP_IMAGE,
      thumbnailUrl: content.newArrivals.images.desktop?.url ?? null,
    },
    kits: {
      id: "kits",
      name: "Kits",
      description: "Portada del bloque de kits. Las tarjetas son los kits publicados.",
      isActive: content.kits.isActive,
      summary: content.kits.title || "Sin título todavía",
      issue: content.kits.images.desktop ? null : NO_DESKTOP_IMAGE,
      thumbnailUrl: content.kits.images.desktop?.url ?? null,
    },
    offerBanner: {
      id: "offerBanner",
      name: "Banner de oferta",
      description: "Foto a todo lo ancho con una frase que corre sin parar y un botón al producto en oferta.",
      isActive: content.offerBanner.isActive,
      summary: content.offerBanner.text || "Sin frase todavía",
      issue: content.offerBanner.images.desktop ? null : NO_DESKTOP_IMAGE,
      thumbnailUrl: content.offerBanner.images.desktop?.url ?? null,
    },
  };

  return HOME_BLOCK_ORDER.map((id) => byId[id]);
}

export type { HomeBlockId, HomeBlockSummary };
export { HOME_BLOCK_ORDER, describeHomeBlocks };
