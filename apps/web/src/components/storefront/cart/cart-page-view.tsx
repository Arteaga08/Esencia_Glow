"use client";

import { CHECKOUT_CTA_LABEL } from "@/lib/storefront/checkout/checkout-mode";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { maxQuantityFor } from "@/lib/storefront/cart/cart-store";
import { removeCartItem, setCartQuantity, useCart } from "@/lib/storefront/cart/use-cart";
import { useResolvedCart } from "@/lib/storefront/cart/use-resolved-cart";
import { CartEmpty } from "./cart-empty";
import { CartLineRow } from "./cart-line-row";
import { CartStatusNote } from "./cart-status-note";
import { CTA_DISABLED, CTA_PRIMARY, TEXT_LINK } from "./cta-styles";
import { TotalsList } from "./totals-list";

/** Mientras no se conoce el carrito del navegador: no se muestra "vacío" por error. */
function CartPageSkeleton() {
  return (
    <div aria-busy="true" className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

/**
 * Página `/carrito` (propuesta A): lista a la izquierda separada por líneas
 * finas y resumen fijo a la derecha, para que el botón de pagar nunca quede
 * lejos. Estados: sin conocer el carrito (Skeleton), vacío, con líneas
 * agotadas (bloquea el pago) y error de lectura (muestra lo guardado).
 */
function CartPageView() {
  const { lines: stored, hydrated } = useCart();
  const { lines, totals, status, retry } = useResolvedCart(stored, hydrated);
  const blocked = lines.some((line) => !line.available);

  return (
    <main className="pt-16 pb-32 xl:pt-20">
      <div className="mx-auto max-w-shell px-4 py-10 md:px-8 md:py-14 xl:px-12">
        <h1 className="text-page-title text-foreground md:text-display">Tu carrito</h1>

        {!hydrated ? (
          <CartPageSkeleton />
        ) : lines.length === 0 ? (
          <CartEmpty className="mt-6" />
        ) : (
          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16">
            <ul className="flex flex-col divide-y divide-border-strong border-y border-border-strong [&>li]:py-6">
              {lines.map((line) => (
                <CartLineRow
                  key={line.key}
                  line={line}
                  maxQuantity={maxQuantityFor(line.itemType)}
                  onQuantityChange={(quantity) => setCartQuantity(line.key, quantity)}
                  onRemove={() => removeCartItem(line.key)}
                />
              ))}
            </ul>

            <aside className="flex flex-col gap-4 rounded-md border border-border-strong bg-surface p-6 lg:sticky lg:top-28 lg:self-start">
              <h2 className="type-shop-card-title text-foreground">Resumen</h2>
              <TotalsList totals={totals} />
              <CartStatusNote status={status} onRetry={retry} />
              {blocked ? (
                <>
                  <span aria-disabled="true" className={`${CTA_DISABLED} w-full`}>
                    {CHECKOUT_CTA_LABEL}
                  </span>
                  <p role="status" className="text-body-sm text-muted-foreground-strong">
                    Quita lo que se agotó para continuar.
                  </p>
                </>
              ) : (
                <Link href="/checkout" className={`${CTA_PRIMARY} w-full`}>
                  {CHECKOUT_CTA_LABEL}
                </Link>
              )}
              <Link href="/" className={`${TEXT_LINK} w-full justify-center`}>
                Seguir comprando
              </Link>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

export { CartPageView };
