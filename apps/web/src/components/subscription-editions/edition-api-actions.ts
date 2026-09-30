import { apiRequest } from "@/lib/api";
import type { AdminSubscriptionEdition } from "@/lib/types/admin-subscription";
import type { CreateEditionBody } from "./create-edition-form";
import type { EditionEditorActions } from "./edition-editor";

const EDITIONS_PATH = "/api/v1/admin/subscription-editions";

/** Escrituras reales de una edición contra
 * admin-subscription-edition.routes.ts. Publicar/despublicar son sub-rutas
 * `POST`, nunca un `PATCH {status}`. */
function editionApiActions(id: string): EditionEditorActions {
  const path = `${EDITIONS_PATH}/${id}`;
  return {
    save: async (body) =>
      (
        await apiRequest<AdminSubscriptionEdition>(path, {
          method: "PATCH",
          authenticated: true,
          body,
        })
      ).data,
    publish: async () =>
      (
        await apiRequest<AdminSubscriptionEdition>(`${path}/publish`, {
          method: "POST",
          authenticated: true,
        })
      ).data,
    unpublish: async () =>
      (
        await apiRequest<AdminSubscriptionEdition>(`${path}/unpublish`, {
          method: "POST",
          authenticated: true,
        })
      ).data,
    remove: async () => {
      await apiRequest(path, { method: "DELETE", authenticated: true });
    },
  };
}

/** Alta en un solo paso (2.7d): título, ciclo y productos viajan juntos. Solo
 * producto, variante y cantidad; nombres y precios los resuelve el backend al leer. */
async function createEdition(body: CreateEditionBody): Promise<AdminSubscriptionEdition> {
  return (
    await apiRequest<AdminSubscriptionEdition>(EDITIONS_PATH, {
      method: "POST",
      authenticated: true,
      body: {
        ...body,
        items: body.items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
      },
    })
  ).data;
}

export { editionApiActions, createEdition };
