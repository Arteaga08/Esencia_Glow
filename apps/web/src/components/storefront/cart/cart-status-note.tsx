import { FieldError } from "@/components/ui/field-error";
import type { ResolveStatus } from "@/lib/storefront/cart/use-resolved-cart";
import { FOCUS } from "./cta-styles";

/**
 * Aviso del estado de la lectura de precios, pegado al resumen: mientras llega
 * la respuesta (se ve lo guardado) y, si falla, el error con su reintento. Con
 * la lectura lista no pinta nada.
 */
function CartStatusNote({ status, onRetry }: { status: ResolveStatus; onRetry: () => void }) {
  if (status === "loading") {
    return (
      <p role="status" className="text-body-sm text-muted-foreground-strong">
        Actualizando precios y disponibilidad…
      </p>
    );
  }
  if (status === "error") {
    return (
      <div className="flex flex-col items-start gap-1">
        <FieldError message="No pudimos actualizar los precios. Mostramos lo que guardaste; el cobro final se calcula al pagar." />
        <button
          type="button"
          onClick={onRetry}
          className={`inline-flex min-h-11 cursor-pointer items-center text-body-sm text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground ${FOCUS}`}
        >
          Intentar de nuevo
        </button>
      </div>
    );
  }
  return null;
}

export { CartStatusNote };
