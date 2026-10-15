import type { AdminHomeAdvice } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import { toFormValue, toPayload, type AdviceFormValue } from "./advice-form-value";

const PATH = "/api/v1/admin/home/advice";

interface SaveAdviceResult {
  section: AdminHomeAdvice;
  /** Formulario resultante: si todo salió bien, el estado guardado; si falló la foto, con la foto pendiente. */
  value: AdviceFormValue;
  /** Error del paso de la foto (los textos ya quedaron guardados). */
  imageError?: unknown;
}

/**
 * Guardado del bloque de asesoría en un solo botón: (1) textos y activo
 * (`PUT /advice`); (2) la foto nueva o borrada, con la `version` que devolvió
 * la escritura anterior. Un error del paso (1) se lanza tal cual (400/409,
 * nada se guardó); uno del paso (2) vuelve en `imageError` con lo que sí quedó.
 */
async function saveAdvice(value: AdviceFormValue, version: number): Promise<SaveAdviceResult> {
  let section = (
    await apiRequest<AdminHomeAdvice>(PATH, { method: "PUT", authenticated: true, body: toPayload(value, version) })
  ).data;

  const { image } = value;
  const url = `${PATH}/image`;
  try {
    if (image.file) {
      const body = new FormData();
      body.append("version", String(section.version));
      body.append("image", image.file);
      section = (await apiRequest<AdminHomeAdvice>(url, { method: "PUT", authenticated: true, body })).data;
    } else if (image.removed && image.existing) {
      section = (
        await apiRequest<AdminHomeAdvice>(url, {
          method: "DELETE",
          authenticated: true,
          query: { version: section.version },
        })
      ).data;
    }
  } catch (imageError) {
    return { section, value: { ...toFormValue(section), image: { ...image } }, imageError };
  }

  return { section, value: toFormValue(section) };
}

export { saveAdvice };
export type { SaveAdviceResult };
