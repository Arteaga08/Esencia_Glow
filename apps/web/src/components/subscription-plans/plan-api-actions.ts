import { apiRequest } from "@/lib/api";
import type { AdminSubscriptionPlan } from "@/lib/types/admin-subscription";
import type { PlanEditorActions } from "./plan-editor";

const PLANS_PATH = "/api/v1/admin/subscription-plans";

/** Escrituras reales del editor de plan contra
 * admin-subscription-plan.routes.ts. `DELETE` desactiva, nunca borra. */
const PLAN_API_ACTIONS: PlanEditorActions = {
  create: async (body) =>
    (
      await apiRequest<AdminSubscriptionPlan>(PLANS_PATH, {
        method: "POST",
        authenticated: true,
        body,
      })
    ).data,
  update: async (id, body) =>
    (
      await apiRequest<AdminSubscriptionPlan>(`${PLANS_PATH}/${id}`, {
        method: "PATCH",
        authenticated: true,
        body,
      })
    ).data,
  deactivate: async (id) => {
    await apiRequest(`${PLANS_PATH}/${id}`, { method: "DELETE", authenticated: true });
  },
};

/** Sube las fotos elegidas en el alta, ya con el `id` del plan recién creado
 * (la subruta de imágenes no existe antes). Campo `images`, igual que Productos. */
async function uploadPlanImages(planId: string, files: File[]): Promise<void> {
  const formData = new FormData();
  for (const file of files) formData.append("images", file);
  await apiRequest(`${PLANS_PATH}/${planId}/images`, {
    method: "POST",
    authenticated: true,
    body: formData,
  });
}

export { PLAN_API_ACTIONS, uploadPlanImages };
