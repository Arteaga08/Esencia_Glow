import { useEffect, useState } from "react";
import { apiRequest, ApiRequestError } from "@/lib/api";

interface AdminSubscriptionPlanOption {
  id: string;
  name: string;
}

/** Opciones del filtro "Plan" del listado de Cuentas — trae TODOS los
 * planes (activos e inactivos, `limit` alto de una sola página: no hay
 * paginación real de planes hoy) para que una cuenta en un plan ya
 * desactivado siga siendo filtrable. Solo `id`/`name`: el resto de
 * `AdminSubscriptionPlan` no hace falta para un `<Select>`. */
function usePlanFilterOptions() {
  const [options, setOptions] = useState<AdminSubscriptionPlanOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiRequest<AdminSubscriptionPlanOption[]>("/api/v1/admin/subscription-plans", {
      authenticated: true,
      query: { limit: 100, sort: "name" },
    })
      .then((response) => {
        if (!cancelled) setOptions(response.data);
      })
      .catch((error) => {
        if (!cancelled && error instanceof ApiRequestError) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return options;
}

export { usePlanFilterOptions };
export type { AdminSubscriptionPlanOption };
