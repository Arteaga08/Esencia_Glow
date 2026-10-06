"use client";

import { ShoppingBag } from "@phosphor-icons/react";
import { useCart } from "@/lib/storefront/cart/use-cart";
import { openCartPanel } from "@/lib/storefront/cart/use-cart-panel";

/** Id estable para devolverle el foco a la bolsa al cerrar el panel. */
const CART_BUTTON_ID = "cart-button";

interface CartButtonProps {
  /** Mismas clases que los demás iconos del header. */
  className: string;
  /** Cierra lo que el header tenga abierto (mega panel, menú móvil) antes de abrir el carrito. */
  onOpen?: () => void;
}

/**
 * Bolsa del header con el contador de unidades. Antes de hidratar el contador
 * no se pinta (el servidor no conoce el carrito), así no hay salto ni un "0"
 * que parpadee. Abre el panel lateral, no navega.
 */
function CartButton({ className, onOpen }: CartButtonProps) {
  const { count } = useCart();
  const label = count > 0 ? `Carrito de compras, ${count} ${count === 1 ? "unidad" : "unidades"}` : "Carrito de compras";

  function handleClick() {
    onOpen?.();
    openCartPanel();
  }

  return (
    <button
      id={CART_BUTTON_ID}
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      onClick={handleClick}
      className={`relative cursor-pointer ${className}`}
    >
      <ShoppingBag size={24} aria-hidden="true" />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute right-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-foreground px-1 font-mono text-label leading-5 text-background tabular-nums"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}

export { CartButton, CART_BUTTON_ID };
