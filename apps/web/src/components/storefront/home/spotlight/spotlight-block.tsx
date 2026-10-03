import type { PublicHomeSpotlight } from "@esencia-glow/shared";
import { getHomeContent } from "../../../../lib/storefront/home";
import { getNewArrivals, getShelfKits, SPOTLIGHT_LIMIT } from "../../../../lib/storefront/shelf";
import type { ShelfItem } from "../../../../lib/storefront/shelf-item";
import { SpotlightSection } from "./spotlight-section";

/** Un bloque se pinta solo con foto de escritorio publicada (la trae el API) y al menos una tarjeta. */
function renderSpotlight(
  content: PublicHomeSpotlight | undefined,
  items: ShelfItem[],
  options: { href: string; coverSide: "left" | "right"; tone?: "plain" | "blush" },
) {
  if (!content || items.length === 0) return null;
  const { desktop, mobile } = content.images;
  return (
    <SpotlightSection
      title={content.title}
      subtitle={content.subtitle}
      href={options.href}
      items={items}
      coverSide={options.coverSide}
      tone={options.tone}
      cover={{ desktop: desktop.url, mobile: (mobile ?? desktop).url, alt: desktop.alt ?? "" }}
    />
  );
}

/**
 * Bloque 5 del home: Novedades (portada a la derecha) y Kits (portada a la
 * izquierda). Texto y fotos vienen del panel (Contenido del home); las cuatro
 * tarjetas, del catálogo. Si el API cae, ninguno de los dos se pinta.
 */
async function SpotlightBlock() {
  const [home, newArrivals, kits] = await Promise.all([
    getHomeContent(),
    getNewArrivals(),
    getShelfKits(SPOTLIGHT_LIMIT),
  ]);

  return (
    <>
      {renderSpotlight(home?.newArrivals, newArrivals, { href: "/novedades", coverSide: "right" })}
      {renderSpotlight(home?.kits, kits, { href: "/kits", coverSide: "left", tone: "blush" })}
    </>
  );
}

export { SpotlightBlock };
