import { useCallback, useEffect, useState } from "react";
import type { AdminOrder, AdminOrderInternalNote } from "@esencia-glow/shared";
import { apiRequest, ApiRequestError } from "@/lib/api";

/** Notas internas: sub-recurso propio, no vive en el `AdminOrder` (que solo
 * trae `internalNotesCount`). `addNote` hace el POST (que devuelve el
 * `AdminOrder` con el contador ya actualizado) y luego refresca la lista. */
function useOrderNotes(orderId: string, onOrderUpdated: (order: AdminOrder) => void) {
  const [notes, setNotes] = useState<AdminOrderInternalNote[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const load = useCallback(() => {
    return apiRequest<AdminOrderInternalNote[]>(`/api/v1/admin/orders/${orderId}/notes`, { authenticated: true })
      .then((response) => {
        setNotes(response.data);
        setLoadError(null);
      })
      .catch((error) => {
        setLoadError(error instanceof ApiRequestError ? error.message : "No pudimos cargar las notas.");
      });
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addNote(body: string): Promise<boolean> {
    setSaving(true);
    setFieldError(null);
    try {
      const response = await apiRequest<AdminOrder>(`/api/v1/admin/orders/${orderId}/notes`, {
        method: "POST",
        authenticated: true,
        body: { body },
      });
      onOrderUpdated(response.data);
      await load();
      return true;
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors?.body) {
        setFieldError(error.fieldErrors.body);
      } else {
        setFieldError(error instanceof ApiRequestError ? error.message : "No se pudo agregar la nota.");
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { notes, loadError, saving, fieldError, setFieldError, addNote };
}

export { useOrderNotes };
