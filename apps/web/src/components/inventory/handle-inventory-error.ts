import { ApiRequestError } from "@/lib/api";

interface ToastFn {
  (input: { variant: "error"; title: string; description?: string }): void;
}

interface HandleInventoryErrorInput {
  error: unknown;
  setConflict: (message: string | null) => void;
  toast: ToastFn;
  title: string;
  /** Tras un 409 la variante trae cifras viejas ("El inventario cambió,
   * recarga la vista." o "hay N unidades apartadas"): se relee para que el
   * siguiente intento parta del dato real. */
  refresh?: () => void;
}

/** Copia local de `handle-shipment-error.ts` (2.4): error en línea pegado al
 * formulario + toast de acompañamiento, nunca uno solo. Se duplica en vez de
 * importar para no cruzar la frontera entre features por una sola rama. */
function handleInventoryError({ error, setConflict, toast, title, refresh }: HandleInventoryErrorInput): void {
  if (error instanceof ApiRequestError) {
    setConflict(error.message);
    toast({ variant: "error", title, description: error.message });
    if (error.status === 409) refresh?.();
    return;
  }

  setConflict(null);
  toast({ variant: "error", title, description: "Intenta de nuevo." });
}

export { handleInventoryError };
