"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { formatMoneyMXN } from "@/lib/format-money";
import type { CartItemInput } from "@/lib/storefront/cart/cart-store";
import { addCartItem, type AddToCartResult } from "@/lib/storefront/cart/use-cart";
import { openCartPanel } from "@/lib/storefront/cart/use-cart-panel";
import { FOCUS } from "./product-styles";

const ADDED_FEEDBACK_MS = 1800;

interface AddToCartButtonProps {
  /** Línea que se agrega: variante (o kit) con su snapshot para pintar al instante. */
  item: CartItemInput;
  quantity: number;
  totalCents: number;
  available: boolean;
  /** Texto accesible completo, p. ej. "Agregar 2 Sérum Vitamina C, 30 ml". */
  ariaLabel: string;
  /** Avisa el resultado para que quien lo usa pinte el aviso de tope pegado al control. */
  onResult?: (result: AddToCartResult) => void;
  className?: string;
  /** `lg` es el botón dominante de la columna de compra (h-14). */
  size?: "md" | "lg";
}

/**
 * Botón de agregar al carrito real. Si el carrito cambió abre el panel lateral;
 * si topó un límite no lo abre y deja el aviso a quien lo usa (`onResult`).
 * Estados: reposo, agregado (palomita) y agotado (deshabilitado con texto).
 */
function AddToCartButton({ item, quantity, totalCents, available, ariaLabel, onResult, className = "", size = "md" }: AddToCartButtonProps) {
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleClick() {
    const result = addCartItem(item, quantity);
    onResult?.(result);
    if (!result.changed) return;

    openCartPanel();
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), ADDED_FEEDBACK_MS);
  }

  return (
    <>
      <button
        type="button"
        aria-label={available ? ariaLabel : "Producto agotado"}
        disabled={!available}
        onClick={handleClick}
        className={`flex ${size === "lg" ? "h-14" : "h-12"} min-w-0 cursor-pointer items-center justify-center gap-2 rounded-md border px-6 type-shop-cta text-foreground transition-[background-color,border-color,opacity,transform] duration-[var(--duration-base)] ease-out-quart active:scale-[0.98] disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground-strong ${FOCUS} ${
          added ? "border-primary-action bg-blush" : "border-primary-action bg-primary hover:bg-primary-hover"
        } ${className}`}
      >
        {!available ? (
          "Agotado"
        ) : added ? (
          <>
            <Check size={16} weight="bold" aria-hidden="true" />
            Agregado
          </>
        ) : (
          <>
            <span>Agregar</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatMoneyMXN(totalCents)}</span>
          </>
        )}
      </button>
      <span role="status" className="sr-only">
        {added ? "Agregado al carrito" : ""}
      </span>
    </>
  );
}

export { AddToCartButton };
