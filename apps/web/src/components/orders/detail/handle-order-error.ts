import { ApiRequestError } from "@/lib/api";

interface ToastFn {
  (input: { variant: "error"; title: string; description?: string }): void;
}

interface HandleOrderErrorInput {
  error: unknown;
  /** Solo cuando el error puede traer `fieldErrors` (formularios). Los
   * modales de confirmación sin formulario lo omiten. */
  setFieldErrors?: (errors: Record<string, string>) => void;
  /** Un 409 u otro conflicto que no es de campo: se pinta con `FieldError`
   * junto al control que falló. */
  setConflict: (message: string | null) => void;
  toast: ToastFn;
  /** Título corto de la operación, para el toast de acompañamiento
   * ("No se pudo cambiar el estatus"). */
  title: string;
  /** Se llama tras un 409: el cliente tiene el estado viejo, así que hay
   * que releer el pedido para que las capacidades se actualicen. Se omite
   * en 429/503 (no son un conflicto de estado, son del proveedor/rate limit). */
  refresh?: () => void;
}

/**
 * Escalera única de manejo de errores para las escrituras del detalle de
 * pedido (Fase 6/7 del plan): error en línea pegado al control + toast de
 * acompañamiento, nunca uno solo. Un 409 no viene en `errors`, así que
 * `Input`/`Textarea`/`Select` no lo pintan por sí solos.
 */
function handleOrderError({ error, setFieldErrors, setConflict, toast, title, refresh }: HandleOrderErrorInput): void {
  if (error instanceof ApiRequestError && error.fieldErrors && setFieldErrors) {
    setFieldErrors(error.fieldErrors);
    toast({ variant: "error", title: "Revisa los campos marcados", description: error.message });
    return;
  }

  if (error instanceof ApiRequestError) {
    setConflict(error.message);
    toast({ variant: "error", title, description: error.message });
    if (error.status === 409) refresh?.();
    return;
  }

  setConflict(null);
  toast({ variant: "error", title, description: "Intenta de nuevo." });
}

export { handleOrderError };
