import Link from "next/link";
import { FieldError } from "@/components/ui/field-error";
import { Skeleton } from "@/components/ui/skeleton";
import { CTA_SECONDARY } from "@/components/storefront/cart/cta-styles";

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
function QuoteError({ retryHref }: { retryHref: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-destructive-action bg-surface p-4">
      <FieldError message="No pudimos cotizar el envío. La paquetería tardó demasiado en responder." />
      <p className="text-body-sm text-muted-foreground-strong">Tu carrito y tu dirección siguen guardados.</p>
      <Link href={retryHref} className={CTA_SECONDARY}>
        Reintentar
      </Link>
    </div>
  );
}

export { QuoteSkeleton, QuoteError };
