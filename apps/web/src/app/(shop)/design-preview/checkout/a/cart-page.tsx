"use client";

import Link from "next/link";
import { CartEmpty } from "../_kit/cart-empty";
import { CartLineRow } from "../_kit/cart-line-row";
import { CTA_DISABLED, CTA_PRIMARY, TEXT_LINK } from "../_kit/cta-styles";
import { previewHref } from "../_kit/preview-state";
import type { PreviewData } from "../_kit/preview-types";
import { TotalsList } from "../_kit/totals-list";
import { computeTotals } from "../_kit/totals";
import { useCartLines } from "../_kit/use-cart-lines";

interface CartPageProps {
  data: PreviewData;
  state: string | null;
  base: string;
}

/**
 * Propuesta A, carrito: lista a la izquierda separada por líneas finas (sin
 * tarjetas) y resumen fijo a la derecha. El resumen no se despega al
 * desplazarse, así el botón de pagar nunca queda lejos.
 */
function CartPageA({ data, state, base }: CartPageProps) {
  const { lines, setQuantity, remove } = useCartLines(data.lines, state);
  const totals = computeTotals(lines, null);
  const blocked = lines.some((line) => !line.available);

  return (
    <main className="pt-16 pb-32 xl:pt-20">
      <div className="mx-auto max-w-shell px-4 py-10 md:px-8 md:py-14 xl:px-12">
        <h1 className="text-page-title text-foreground md:text-display">Tu carrito</h1>

        {lines.length === 0 ? (
          <CartEmpty className="mt-6" />
        ) : (
          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16">
            <ul className="flex flex-col divide-y divide-border-strong border-y border-border-strong [&>li]:py-6">
              {lines.map((line) => (
                <CartLineRow key={line.id} line={line} onQuantityChange={(quantity) => setQuantity(line.id, quantity)} onRemove={() => remove(line.id)} />
              ))}
            </ul>

            <aside className="rounded-md border border-border-strong bg-surface p-6 lg:sticky lg:top-28 lg:self-start">
              <h2 className="mb-5 type-shop-card-title text-foreground">Resumen</h2>
              <TotalsList totals={totals} />
              {blocked ? (
                <>
                  <span aria-disabled="true" className={`${CTA_DISABLED} mt-6 w-full`}>
                    Continuar al pago
                  </span>
                  <p role="status" className="mt-3 text-body-sm text-muted-foreground-strong">Quita lo que se agotó para continuar.</p>
                </>
              ) : (
                <Link href={previewHref(base, "cuenta")} className={`${CTA_PRIMARY} mt-6 w-full`}>
                  Continuar al pago
                </Link>
              )}
              <Link href="/" className={`${TEXT_LINK} mt-2 w-full justify-center`}>
                Seguir comprando
              </Link>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

export { CartPageA };
