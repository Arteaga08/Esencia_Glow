import { ApiRequestError } from "@/lib/api";

interface ToastFn {
  (input: { variant: "error"; title: string; description?: string }): void;
}

interface HandleShipmentErrorInput {
  error: unknown;
  setConflict: (message: string | null) => void;
  toast: ToastFn;
  title: string;
  /** Se llama tras un 409: la fila tiene el estado viejo, hay que releer la
   * cola para que el botón vuelva a reflejar lo que de verdad se puede
   * hacer (memoria del proyecto: error en línea + toast, nunca uno solo). */
  refresh?: () => void;
}

/** Mismo criterio que `handle-order-error.ts` (2.3b): error en línea pegado
 * a la fila + toast de acompañamiento. Copia local en vez de importar
 * desde `orders/detail` — es de una sola línea de lógica y mantiene la
 * frontera entre features. */
function handleShipmentError({ error, setConflict, toast, title, refresh }: HandleShipmentErrorInput): void {
  if (error instanceof ApiRequestError) {
    setConflict(error.message);
    toast({ variant: "error", title, description: error.message });
    if (error.status === 409) refresh?.();
    return;
  }

  setConflict(null);
  toast({ variant: "error", title, description: "Intenta de nuevo." });
}

export { handleShipmentError };
