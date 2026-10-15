import type { AdminHomeOfferBanner, AdminHomePageCovers } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import { PAGE_COVERS, toFormValue, type PageCoversFormValue } from "./page-covers-form-value";

const PATH = "/api/v1/admin/home";

interface SavePageCoversResult {
  section: AdminHomePageCovers;
  offerBanner: AdminHomeOfferBanner;
  /** Formulario resultante: si todo salió bien, el estado guardado; si falló una foto, con lo pendiente. */
  value: PageCoversFormValue;
  /** Primer error de una foto (las anteriores ya quedaron guardadas). */
  imageError?: unknown;
}

/**
 * Guardado de las fotos de encabezado en un solo botón. Sin texto: cada foto
 * nueva o borrada es una escritura con control optimista, encadenada con la
 * `version` que devolvió la anterior DE SU SECCIÓN (Más vendidos y Kits van a
 * `pageCovers`; Ofertas, a `offerBanner`). Si una falla, vuelve en
 * `imageError` junto con lo que sí quedó guardado.
 */
async function savePageCovers(
  value: PageCoversFormValue,
  saved: AdminHomePageCovers,
  savedOfferBanner: AdminHomeOfferBanner,
): Promise<SavePageCoversResult> {
  let section = saved;
  let offerBanner = savedOfferBanner;
  const next: PageCoversFormValue = { kits: { ...value.kits }, bestsellers: { ...value.bestsellers }, sale: { ...value.sale } };

  for (const { key } of PAGE_COVERS) {
    const image = next[key];
    const isSale = key === "sale";
    const url = isSale ? `${PATH}/offer-banner/images/page` : `${PATH}/page-covers/${key}/image`;
    const version = isSale ? offerBanner.version : section.version;
    try {
      let method: "PUT" | "DELETE";
      let body: FormData | undefined;
      if (image.file) {
        method = "PUT";
        body = new FormData();
        body.append("version", String(version));
        body.append("image", image.file);
      } else if (image.removed && image.existing) {
        method = "DELETE";
      } else continue;
      const request = { method, authenticated: true, ...(body ? { body } : { query: { version } }) };
      if (isSale) {
        offerBanner = (await apiRequest<AdminHomeOfferBanner>(url, request)).data;
        next.sale = { existing: offerBanner.images.page, removed: false };
      } else {
        section = (await apiRequest<AdminHomePageCovers>(url, request)).data;
        next[key] = { existing: section.images[key], removed: false };
      }
    } catch (imageError) {
      return { section, offerBanner, value: next, imageError };
    }
  }

  return { section, offerBanner, value: toFormValue(section, offerBanner) };
}

export { savePageCovers };
export type { SavePageCoversResult };
