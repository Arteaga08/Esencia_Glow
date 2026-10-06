import { FieldError } from "@/components/ui/field-error";
import { Skeleton } from "@/components/ui/skeleton";
import { CTA_SECONDARY } from "../cart/cta-styles";

/** Mientras la paquetería responde: bloques con la forma de las tarjetas reales (nunca un spinner). */
function QuoteSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <p className="mb-3 text-body-sm text-muted-foreground-strong">Consultando tarifas con las paqueterías…</p>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  );
}

/** La cotización falló o tardó demasiado: se dice qué pasó y la compra no se pierde. */
function QuoteError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-destructive-action bg-surface p-4">
      <FieldError message="No pudimos cotizar el envío en este momento. La paquetería tardó demasiado o no respondió." />
      <p className="text-body-sm text-muted-foreground-strong">Tu carrito y tu dirección siguen guardados.</p>
      <button type="button" onClick={onRetry} className={CTA_SECONDARY}>
        Reintentar
      </button>
    </div>
  );
}

/** Un aviso de la cotización que no es una falla del sistema (sin cobertura, cotización vencida, algo se agotó). */
function QuoteNotice({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-destructive-action bg-surface p-4">
      <FieldError message={message} />
      {hint ? <p className="text-body-sm text-muted-foreground-strong">{hint}</p> : null}
    </div>
  );
}

export { QuoteSkeleton, QuoteError, QuoteNotice };
