import { apiRequest } from "@/lib/api";
import type { AdminEditionItem, AdminSubscriptionEdition } from "@/lib/types/admin-subscription";
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

async function createEdition(body: CreateEditionBody): Promise<AdminSubscriptionEdition> {
  return (
    await apiRequest<AdminSubscriptionEdition>(EDITIONS_PATH, {
      method: "POST",
      authenticated: true,
      body: { ...body },
    })
  ).data;
}

/** Copia los productos de otra caja a una edición recién creada. Solo viajan
 * producto, variante y cantidad; lo demás (nombres, precios) el backend lo
 * resuelve al leer. */
async function copyEditionItems(
  editionId: string,
  items: AdminEditionItem[],
): Promise<AdminSubscriptionEdition> {
  return (
    await apiRequest<AdminSubscriptionEdition>(`${EDITIONS_PATH}/${editionId}`, {
      method: "PATCH",
      authenticated: true,
      body: {
        items: items.map(({ productId, variantId, quantity }) => ({ productId, variantId, quantity })),
      },
    })
  ).data;
}

export { editionApiActions, createEdition, copyEditionItems };
