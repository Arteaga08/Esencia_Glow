import type { AdminHomeSpotlight } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import type { HeroImageSlot } from "./hero-form-value";
import {
  toFormValue,
  toPayload,
  type SpotlightFormValue,
  type SpotlightMeta,
} from "./spotlight-form-value";

const SLOTS: HeroImageSlot[] = ["desktop", "mobile"];

interface SaveSpotlightResult {
  section: AdminHomeSpotlight;
  /** Formulario resultante: si todo salió bien, el estado guardado; si falló una foto, con lo pendiente. */
  value: SpotlightFormValue;
  /** Primer error de un paso de imagen (el texto ya quedó guardado). */
  imageError?: unknown;
}

/**
 * Guardado de Novedades o Kits en un solo botón. Varias escrituras de la misma
 * sección con control optimista, encadenadas: (1) título/subtítulo/activo
 * (`PUT /spotlights/:slug`); (2) cada foto nueva o borrada, con la `version`
 * que devolvió la escritura anterior. Un error del paso (1) se lanza tal cual
 * (400/409, nada se guardó); uno del paso (2) vuelve en `imageError` junto con
 * lo que sí quedó guardado, para no perder las fotos pendientes.
 */
async function saveSpotlight(
  meta: SpotlightMeta,
  value: SpotlightFormValue,
  version: number,
): Promise<SaveSpotlightResult> {
  const path = `/api/v1/admin/home/spotlights/${meta.slug}`;
  let section = (
    await apiRequest<AdminHomeSpotlight>(path, {
      method: "PUT",
      authenticated: true,
      body: toPayload(value, version),
    })
  ).data;

  const images = { desktop: { ...value.images.desktop }, mobile: { ...value.images.mobile } };

  for (const slot of SLOTS) {
    const image = images[slot];
    const url = `${path}/images/${slot}`;
    try {
      if (image.file) {
        const body = new FormData();
        body.append("version", String(section.version));
        body.append("image", image.file);
        section = (await apiRequest<AdminHomeSpotlight>(url, { method: "PUT", authenticated: true, body })).data;
      } else if (image.removed && image.existing) {
        section = (
          await apiRequest<AdminHomeSpotlight>(url, {
            method: "DELETE",
            authenticated: true,
            query: { version: section.version },
          })
        ).data;
      } else continue;
      images[slot] = { existing: section.images[slot], removed: false };
    } catch (imageError) {
      return { section, value: { ...value, isActive: section.isActive, images }, imageError };
    }
  }

  return { section, value: toFormValue(section, meta) };
}

export { saveSpotlight };
export type { SaveSpotlightResult };
