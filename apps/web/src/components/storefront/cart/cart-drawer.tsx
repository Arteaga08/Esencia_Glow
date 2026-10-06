"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";
import { formatMoneyMXN } from "@/lib/format-money";
import { maxQuantityFor } from "@/lib/storefront/cart/cart-store";
import { removeCartItem, setCartQuantity, useCart } from "@/lib/storefront/cart/use-cart";
import { closeCartPanel, useCartPanelOpen } from "@/lib/storefront/cart/use-cart-panel";
import { useResolvedCart } from "@/lib/storefront/cart/use-resolved-cart";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { CART_BUTTON_ID } from "./cart-button";
import { CartEmpty } from "./cart-empty";
import { CartLineRow } from "./cart-line-row";
import { CartStatusNote } from "./cart-status-note";
import { CTA_DISABLED, CTA_PRIMARY, FOCUS, TEXT_LINK } from "./cta-styles";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Panel lateral del carrito (propuesta A: blanco, líneas finas). Se monta una
 * sola vez en el layout de la tienda y lo abren la bolsa del header y cualquier
 * "Agregar". Foco atrapado, Escape y clic fuera lo cierran; la página de atrás
 * no se desplaza y, al cerrar, el foco vuelve a la bolsa.
 */
function CartDrawer() {
  const open = useCartPanelOpen();
  const pathname = usePathname();
  const panelRef = useRef<HTMLElement>(null);
  const { lines: stored, hydrated } = useCart();
  const { lines, totals, status, retry } = useResolvedCart(stored, open);

  useFocusTrap(panelRef, open);

  // Navegar a otra página (p. ej. "Ver carrito completo") cierra el panel.
  useEffect(() => {
    closeCartPanel();
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeCartPanel();
        return;
      }
      // Quitar una línea o llegar al tope deshabilita/elimina el botón enfocado y el
      // foco cae al <body>: `useFocusTrap` no lo ve (solo intercepta en el primer y
      // último elemento), así que aquí se devuelve al panel con el siguiente Tab.
      const panel = panelRef.current;
      if (event.key === "Tab" && panel && !panel.contains(document.activeElement)) {
        event.preventDefault();
        panel.querySelector<HTMLElement>(FOCUSABLE)?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Va DESPUÉS de `useFocusTrap`: su limpieza devuelve el foco a quien abrió
  // (a veces un chip que ya no existe) y esta lo lleva a la bolsa.
  useEffect(() => {
    if (!open) return;
    return () => document.getElementById(CART_BUTTON_ID)?.focus();
  }, [open]);

  if (!open) return null;

  const blocked = lines.some((line) => !line.available);
  const count = hydrated ? stored.reduce((sum, line) => sum + line.quantity, 0) : 0;

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Cerrar carrito"
        onClick={closeCartPanel}
        className="fixed inset-0 z-[55] cursor-default bg-foreground/25"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col border-l border-border-strong bg-surface shadow-modal"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border-strong px-5">
          <h2 className="type-shop-card-title text-foreground">
            Tu carrito
            {count > 0 ? (
              <span className="ml-2 font-mono text-body-sm normal-case tracking-normal text-muted-foreground-strong">({count})</span>
            ) : null}
          </h2>
          <button
            type="button"
            aria-label="Cerrar carrito"
            onClick={closeCartPanel}
            className={`inline-flex size-11 cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-foreground/8 ${FOCUS}`}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {lines.length === 0 ? (
          <CartEmpty className="flex-1 justify-center" onNavigate={closeCartPanel} />
        ) : (
          <>
            <ul className="flex flex-1 flex-col divide-y divide-border-strong overflow-y-auto px-5 [&>li]:py-5">
              {lines.map((line) => (
                <CartLineRow
                  key={line.key}
                  line={line}
                  size="sm"
                  maxQuantity={maxQuantityFor(line.itemType)}
                  onQuantityChange={(quantity) => setCartQuantity(line.key, quantity)}
                  onRemove={() => removeCartItem(line.key)}
                />
              ))}
            </ul>

            <footer className="flex shrink-0 flex-col gap-4 border-t border-border-strong p-5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-subtitle text-foreground">Subtotal</span>
                <span className="font-mono text-subtitle tabular-nums text-foreground">{formatMoneyMXN(totals.subtotalCents)}</span>
              </div>
              <p className="text-body-sm text-muted-foreground-strong">El envío se calcula en el siguiente paso. Los precios ya incluyen IVA.</p>
              <CartStatusNote status={status} onRetry={retry} />
              {blocked ? (
                <>
                  <span aria-disabled="true" className={`${CTA_DISABLED} w-full`}>
                    Continuar al pago
                  </span>
                  <p role="status" className="text-body-sm text-muted-foreground-strong">
                    Quita lo que se agotó para continuar.
                  </p>
                </>
              ) : (
                <Link href="/checkout" onClick={closeCartPanel} className={`${CTA_PRIMARY} w-full`}>
                  Continuar al pago
                </Link>
              )}
              <Link href="/carrito" onClick={closeCartPanel} className={`${TEXT_LINK} self-center`}>
                Ver carrito completo
              </Link>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}

export { CartDrawer };
