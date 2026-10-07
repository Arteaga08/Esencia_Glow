import type { AdminHomeOfferBanner } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import { OFFER_BANNER_IMAGE_SLOTS, toFormValue, toPayload, type OfferBannerFormValue } from "./offer-banner-form-value";

const PATH = "/api/v1/admin/home/offer-banner";

interface SaveOfferBannerResult {
  section: AdminHomeOfferBanner;
  /** Formulario resultante: si todo salió bien, el estado guardado; si falló una foto, con lo pendiente. */
  value: OfferBannerFormValue;
  /** Primer error de un paso de imagen (el texto ya quedó guardado). */
  imageError?: unknown;
}

/**
 * Guardado del banner de oferta en un solo botón, igual que Novedades/Kits:
 * (1) frase, botón, enlace y activo (`PUT /offer-banner`); (2) cada foto nueva
 * o borrada, con la `version` que devolvió la escritura anterior. Un error del
 * paso (1) se lanza tal cual (400/409, nada se guardó); uno del paso (2)
 * vuelve en `imageError` junto con lo que sí quedó guardado.
 */
async function saveOfferBanner(value: OfferBannerFormValue, version: number): Promise<SaveOfferBannerResult> {
  let section = (
    await apiRequest<AdminHomeOfferBanner>(PATH, {
      method: "PUT",
      authenticated: true,
      body: toPayload(value, version),
    })
  ).data;

  const images = {
    desktop: { ...value.images.desktop },
    mobile: { ...value.images.mobile },
    page: { ...value.images.page },
  };

  for (const slot of OFFER_BANNER_IMAGE_SLOTS) {
    const image = images[slot];
    const url = `${PATH}/images/${slot}`;
    try {
      if (image.file) {
        const body = new FormData();
        body.append("version", String(section.version));
        body.append("image", image.file);
        section = (await apiRequest<AdminHomeOfferBanner>(url, { method: "PUT", authenticated: true, body })).data;
      } else if (image.removed && image.existing) {
        section = (
          await apiRequest<AdminHomeOfferBanner>(url, {
            method: "DELETE",
            authenticated: true,
            query: { version: section.version },
          })
        ).data;
      } else continue;
      images[slot] = { existing: section.images[slot], removed: false };
    } catch (imageError) {
      return { section, value: { ...toFormValue(section), images }, imageError };
    }
  }

  return { section, value: toFormValue(section) };
}

export { saveOfferBanner };
export type { SaveOfferBannerResult };
