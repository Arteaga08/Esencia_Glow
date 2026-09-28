import { ApiRequestError } from "@/lib/api";

interface ToastFn {
  (input: { variant: "error"; title: string; description?: string }): void;
}

interface HandleEnrollmentErrorInput {
  error: unknown;
  setConflict: (message: string | null) => void;
  toast: ToastFn;
  title: string;
}

/** Copia local de `handle-inventory-error.ts` (2.5)/`handle-shipment-error.ts`
 * (2.4): error EN LÍNEA junto al control + toast de acompañamiento, nunca
 * uno solo — el 409 de `assertWindowClearOfAnchor` (ventana que se cruza
 * con el día de cobro) llega aquí en lenguaje humano y se pinta junto al
 * botón que lo disparó, no solo en el toast. Se duplica en vez de importar:
 * misma disciplina del resto del repo (no cruzar la frontera entre
 * features por una sola rama). */
function handleEnrollmentError({ error, setConflict, toast, title }: HandleEnrollmentErrorInput): void {
  if (error instanceof ApiRequestError) {
    setConflict(error.message);
    toast({ variant: "error", title, description: error.message });
    return;
  }

  setConflict(null);
  toast({ variant: "error", title, description: "Intenta de nuevo." });
}

export { handleEnrollmentError };
