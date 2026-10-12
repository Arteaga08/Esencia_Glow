import type { AdminHomePageCovers } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import { PAGE_COVERS, toFormValue, type PageCoversFormValue } from "./page-covers-form-value";

const PATH = "/api/v1/admin/home/page-covers";

interface SavePageCoversResult {
  section: AdminHomePageCovers;
  /** Formulario resultante: si todo salió bien, el estado guardado; si falló una foto, con lo pendiente. */
  value: PageCoversFormValue;
  /** Primer error de una foto (las anteriores ya quedaron guardadas). */
  imageError?: unknown;
}

/**
 * Guardado de las fotos de encabezado en un solo botón. La sección no tiene
 * texto: cada foto nueva o borrada es una escritura con control optimista,
 * encadenada con la `version` que devolvió la anterior. Si una falla, vuelve
 * en `imageError` junto con lo que sí quedó guardado.
 */
async function savePageCovers(value: PageCoversFormValue, saved: AdminHomePageCovers): Promise<SavePageCoversResult> {
  let section = saved;
  const next: PageCoversFormValue = { kits: { ...value.kits }, bestsellers: { ...value.bestsellers } };

  for (const { key } of PAGE_COVERS) {
    const image = next[key];
    const url = `${PATH}/${key}/image`;
    try {
      if (image.file) {
        const body = new FormData();
        body.append("version", String(section.version));
        body.append("image", image.file);
        section = (await apiRequest<AdminHomePageCovers>(url, { method: "PUT", authenticated: true, body })).data;
      } else if (image.removed && image.existing) {
        section = (
          await apiRequest<AdminHomePageCovers>(url, {
            method: "DELETE",
            authenticated: true,
            query: { version: section.version },
          })
        ).data;
      } else continue;
      next[key] = { existing: section.images[key], removed: false };
    } catch (imageError) {
      return { section, value: next, imageError };
    }
  }

  return { section, value: toFormValue(section) };
}

export { savePageCovers };
export type { SavePageCoversResult };
