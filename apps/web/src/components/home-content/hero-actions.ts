import type { AdminHomeHero } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import type { HeroFormValue, HeroImageSlot, HeroSlideDraft } from "./hero-form-value";
import { toFormValue, toPayload } from "./hero-form-value";

const HERO_PATH = "/api/v1/admin/home/hero";
const SLOTS: HeroImageSlot[] = ["desktop", "mobile"];

interface SaveHeroResult {
  hero: AdminHomeHero;
  /** Formulario resultante: si todo salió bien, el estado guardado; si falló un paso de imagen, con lo que quedó pendiente. */
  value: HeroFormValue;
  /** Primer error de un paso de imagen (el contenido ya quedó guardado). */
  imageError?: unknown;
}

/**
 * Guardado del hero en un solo botón. Son varias escrituras del mismo
 * documento con control optimista, así que se encadenan: (1) el contenido
 * (`PUT /hero`), que devuelve los ids de los slides nuevos; (2) cada foto
 * nueva o borrada, usando la `version` que devolvió la escritura anterior.
 * Un error del paso (1) se lanza tal cual (400/409, nada se guardó); uno del
 * paso (2) se devuelve en `imageError` junto con lo que sí quedó guardado,
 * para que el editor no pierda las fotos pendientes.
 */
async function saveHero(value: HeroFormValue, version: number): Promise<SaveHeroResult> {
  const saved = await apiRequest<AdminHomeHero>(HERO_PATH, {
    method: "PUT",
    authenticated: true,
    body: toPayload(value, version),
  });

  let hero = saved.data;
  // El servidor conserva el orden: el slide i del formulario es el slide i de la respuesta.
  const slides: HeroSlideDraft[] = value.slides.map((slide, position) => ({
    ...slide,
    // Copia propia de `images`: abajo se reemplaza por slot y no debe mutar el estado de React.
    images: { ...slide.images },
    id: hero.slides[position]?.id ?? slide.id,
  }));

  for (const slide of slides) {
    for (const slot of SLOTS) {
      const image = slide.images[slot];
      const base = `${HERO_PATH}/slides/${slide.id}/images/${slot}`;
      try {
        if (image.file) {
          const body = new FormData();
          body.append("version", String(hero.version));
          body.append("image", image.file);
          hero = (
            await apiRequest<AdminHomeHero>(base, { method: "PUT", authenticated: true, body })
          ).data;
        } else if (image.removed && image.existing) {
          hero = (
            await apiRequest<AdminHomeHero>(base, {
              method: "DELETE",
              authenticated: true,
              query: { version: hero.version },
            })
          ).data;
        } else continue;
        slide.images[slot] = {
          existing: hero.slides.find((s) => s.id === slide.id)?.images[slot],
          removed: false,
        };
      } catch (imageError) {
        return { hero, value: { isActive: hero.isActive, slides }, imageError };
      }
    }
  }

  return { hero, value: toFormValue(hero) };
}

export { saveHero };
export type { SaveHeroResult };
