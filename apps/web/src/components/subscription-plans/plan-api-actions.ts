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

export { PLAN_API_ACTIONS };
