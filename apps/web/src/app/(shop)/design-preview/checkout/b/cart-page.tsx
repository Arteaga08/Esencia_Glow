"use client";

import Link from "next/link";
import { CartEmpty } from "@/components/storefront/cart/cart-empty";
import { CartLineRow } from "@/components/storefront/cart/cart-line-row";
import { CTA_DISABLED, CTA_PRIMARY, TEXT_LINK } from "@/components/storefront/cart/cta-styles";
import { previewHref } from "../_kit/preview-state";
import type { PreviewData } from "../_kit/preview-types";
import { TotalsList } from "@/components/storefront/cart/totals-list";
import { computeTotals } from "../_kit/totals";
import { useCartLines } from "../_kit/use-cart-lines";

interface CartPageProps {
  data: PreviewData;
  state: string | null;
  base: string;
}

/**
 * Propuesta B, carrito: banda rosa `blush` con el título (la misma que cierra
 * la página de producto) y el resumen en un panel rosa. La lista queda
 * limpia sobre el fondo, sin líneas, separada solo por espacio.
 */
function CartPageB({ data, state, base }: CartPageProps) {
  const { lines, setQuantity, remove } = useCartLines(data.lines, state);
  const totals = computeTotals(lines, null);
  const blocked = lines.some((line) => !line.available);

  return (
    <main className="pt-16 pb-32 xl:pt-20">
      <header className="bg-blush">
        <div className="mx-auto max-w-shell px-4 py-10 md:px-8 md:py-14 xl:px-12">
          <h1 className="text-page-title text-foreground md:text-display">Tu carrito</h1>
          <p className="mt-1 text-body text-foreground/80">
            {lines.length === 0 ? "Aún no agregas nada." : `${totals.itemCount} ${totals.itemCount === 1 ? "producto" : "productos"} listos para tu rutina.`}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-shell px-4 py-10 md:px-8 md:py-14 xl:px-12">
        {lines.length === 0 ? (
          <CartEmpty />
        ) : (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16">
            <ul className="flex flex-col gap-10">
              {lines.map((line) => (
                <CartLineRow key={line.id} line={line} onQuantityChange={(quantity) => setQuantity(line.id, quantity)} onRemove={() => remove(line.id)} />
              ))}
            </ul>

            <aside className="rounded-md bg-blush p-6 lg:sticky lg:top-28 lg:self-start">
              <h2 className="mb-5 type-shop-card-title text-foreground">Resumen</h2>
              <TotalsList totals={totals} />
              {blocked ? (
                <>
                  <span aria-disabled="true" className={`${CTA_DISABLED} mt-6 w-full`}>
                    Continuar al pago
                  </span>
                  <p role="status" className="mt-3 text-body-sm text-foreground/80">Quita lo que se agotó para continuar.</p>
                </>
              ) : (
                <Link href={previewHref(base, "cuenta")} className={`${CTA_PRIMARY} mt-6 w-full !bg-surface hover:!bg-muted`}>
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

export { CartPageB };
