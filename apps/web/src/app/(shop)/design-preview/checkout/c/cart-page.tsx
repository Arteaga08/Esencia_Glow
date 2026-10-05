"use client";

import Link from "next/link";
import { CartEmpty } from "../_kit/cart-empty";
import { CTA_DISABLED, CTA_PRIMARY_LARGE, TEXT_LINK } from "../_kit/cta-styles";
import { previewHref } from "../_kit/preview-state";
import type { PreviewData } from "../_kit/preview-types";
import { TotalsList } from "../_kit/totals-list";
import { computeTotals } from "../_kit/totals";
import { useCartLines } from "../_kit/use-cart-lines";
import { CartCard } from "./cart-card";

interface CartPageProps {
  data: PreviewData;
  state: string | null;
  base: string;
}

/**
 * Propuesta C, carrito: las líneas como tarjetas de foto grande (como el
 * estante del home) y, al final, una franja rosa con el resumen a la izquierda
 * y el botón de pagar a la derecha. Sin columna lateral: la compra se lee de
 * arriba abajo.
 */
function CartPageC({ data, state, base }: CartPageProps) {
  const { lines, setQuantity, remove } = useCartLines(data.lines, state);
  const totals = computeTotals(lines, null);
  const blocked = lines.some((line) => !line.available);

  return (
    <main className="pt-16 pb-32 xl:pt-20">
      <div className="mx-auto max-w-shell px-4 py-10 md:px-8 md:py-14 xl:px-12">
        <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h1 className="type-shop-section text-foreground">Tu carrito</h1>
          {lines.length > 0 ? <p className="text-body text-muted-foreground-strong">{totals.itemCount} {totals.itemCount === 1 ? "producto" : "productos"}</p> : null}
        </header>

        {lines.length === 0 ? (
          <CartEmpty className="mt-6" />
        ) : (
          <>
            <ul className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {lines.map((line) => (
                <CartCard key={line.id} line={line} onQuantityChange={(quantity) => setQuantity(line.id, quantity)} onRemove={() => remove(line.id)} />
              ))}
            </ul>

            <section aria-label="Resumen de la compra" className="mt-14 grid gap-8 rounded-md bg-blush p-6 md:grid-cols-[minmax(0,26rem)_auto] md:items-end md:justify-between md:p-10">
              <TotalsList totals={totals} />
              <div className="flex flex-col items-stretch gap-2 md:items-end">
                {blocked ? (
                  <>
                    <span aria-disabled="true" className={`${CTA_DISABLED} h-14 md:min-w-72`}>
                      Continuar al pago
                    </span>
                    <p role="status" className="text-body-sm text-foreground/80">Quita lo que se agotó para continuar.</p>
                  </>
                ) : (
                  <Link href={previewHref(base, "cuenta")} className={`${CTA_PRIMARY_LARGE} !bg-surface hover:!bg-muted md:min-w-72`}>
                    Continuar al pago
                  </Link>
                )}
                <Link href="/" className={`${TEXT_LINK} self-center md:self-end`}>
                  Seguir comprando
                </Link>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export { CartPageC };
