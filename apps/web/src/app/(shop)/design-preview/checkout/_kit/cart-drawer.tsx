"use client";

import Link from "next/link";
import { X } from "@phosphor-icons/react";
import { formatMoneyMXN } from "@/lib/format-money";
import { CartEmpty } from "@/components/storefront/cart/cart-empty";
import { CartLineRow } from "@/components/storefront/cart/cart-line-row";
import { CTA_DISABLED, CTA_PRIMARY, CTA_PRIMARY_LARGE, CTA_SECONDARY, FOCUS, TEXT_LINK } from "@/components/storefront/cart/cta-styles";
import { previewHref } from "./preview-state";
import type { PreviewData } from "./preview-types";
import { computeTotals } from "./totals";
import { useCartLines } from "./use-cart-lines";

type DrawerVariant = "a" | "b" | "c";

interface CartDrawerProps {
  variant: DrawerVariant;
  data: PreviewData;
  state: string | null;
  /** Ruta de la propuesta, para los enlaces de cerrar, ver carrito y pagar. */
  base: string;
}

/**
 * Panel lateral del carrito. Misma estructura en las tres propuestas, distinto
 * acabado: A es blanco con líneas finas, B va en rosa `blush` con el pie
 * blanco y dos botones, C es más ancho, con fotos grandes y el total
 * protagonista. Sin foco atrapado ni Esc: es una vista previa, no el componente final.
 */
function CartDrawer({ variant, data, state, base }: CartDrawerProps) {
  const { lines, setQuantity, remove } = useCartLines(data.lines, state);
  const totals = computeTotals(lines, null);
  const blocked = lines.some((line) => !line.available);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const checkoutHref = previewHref(base, "cuenta");
  const cartHref = previewHref(base, "carrito");

  const surface = variant === "b" ? "bg-blush" : "bg-surface";
  const width = variant === "c" ? "max-w-lg" : "max-w-md";

  const payButton = blocked ? (
    <span aria-disabled="true" className={`${CTA_DISABLED} w-full`}>
      Continuar al pago
    </span>
  ) : (
    <Link href={checkoutHref} className={`${variant === "c" ? CTA_PRIMARY_LARGE : CTA_PRIMARY} w-full`}>
      {variant === "b" ? "Pagar" : "Continuar al pago"}
    </Link>
  );

  return (
    <>
      <Link href={cartHref} aria-label="Cerrar carrito" className="fixed inset-0 z-[55] cursor-default bg-foreground/25" />
      <aside role="dialog" aria-modal="true" aria-label="Carrito de compras" className={`fixed inset-y-0 right-0 z-[60] flex w-full ${width} flex-col border-l border-border-strong shadow-modal ${surface}`}>
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border-strong px-5">
          <h2 className={variant === "c" ? "type-shop-section text-foreground" : "type-shop-card-title text-foreground"}>
            Tu carrito
            {count > 0 ? <span className="ml-2 font-mono text-body-sm text-muted-foreground-strong normal-case tracking-normal">({count})</span> : null}
          </h2>
          <Link href={cartHref} aria-label="Cerrar carrito" className={`inline-flex size-11 items-center justify-center rounded-md text-foreground hover:bg-foreground/8 ${FOCUS}`}>
            <X size={20} aria-hidden="true" />
          </Link>
        </header>

        {lines.length === 0 ? (
          <CartEmpty className="flex-1 justify-center" />
        ) : (
          <>
            <ul className={`flex-1 overflow-y-auto px-5 ${variant === "c" ? "flex flex-col gap-8 py-8" : "flex flex-col divide-y divide-border-strong [&>li]:py-5"}`}>
              {lines.map((line) => (
                <CartLineRow key={line.id} line={line} size={variant === "c" ? "md" : "sm"} onQuantityChange={(quantity) => setQuantity(line.id, quantity)} onRemove={() => remove(line.id)} />
              ))}
            </ul>

            <footer className={`flex shrink-0 flex-col gap-4 border-t border-border-strong p-5 ${variant === "b" ? "bg-surface" : ""}`}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-subtitle text-foreground">Subtotal</span>
                <span className={`font-mono tabular-nums text-foreground ${variant === "c" ? "text-[28px] leading-none" : "text-subtitle"}`}>{formatMoneyMXN(totals.subtotalCents)}</span>
              </div>
              <p className="text-body-sm text-muted-foreground-strong">El envío se calcula en el siguiente paso. Los precios ya incluyen IVA.</p>
              {variant === "b" ? (
                <div className="grid grid-cols-2 gap-2">
                  <Link href={cartHref} className={CTA_SECONDARY}>
                    Ver carrito
                  </Link>
                  {payButton}
                </div>
              ) : (
                <>
                  {payButton}
                  <Link href={cartHref} className={`${TEXT_LINK} self-center`}>
                    Ver carrito completo
                  </Link>
                </>
              )}
              {blocked ? <p role="status" className="text-body-sm text-muted-foreground-strong">Quita lo que se agotó para continuar.</p> : null}
            </footer>
          </>
        )}
      </aside>
    </>
  );
}

export { CartDrawer };
export type { DrawerVariant };
