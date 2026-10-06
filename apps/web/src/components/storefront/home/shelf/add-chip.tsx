"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { formatMoneyMXN } from "@/lib/format-money";
import { describeAddOutcome } from "@/lib/storefront/cart/add-outcome-copy";
import type { CartItemInput } from "@/lib/storefront/cart/cart-store";
import { addCartItem } from "@/lib/storefront/cart/use-cart";
import { openCartPanel } from "@/lib/storefront/cart/use-cart-panel";

type ChipState = "idle" | "added" | "limit";

const FEEDBACK_MS = 1800;

interface AddChipProps {
  /** Línea que agrega la ficha: variante (o kit) con su snapshot. */
  item: CartItemInput;
  label: string;
  priceCents: number;
  /** Texto accesible completo, p. ej. "Agregar Sérum, 30 ml". */
  ariaLabel: string;
  /** Con varias fichas en fila no cabe etiqueta y precio lado a lado: se apilan. */
  stacked?: boolean;
}

/**
 * Ficha de presentación que además agrega al carrito: elegir la variante y
 * agregarla es un solo clic (sin botón aparte). Si el carrito cambió abre el
 * panel lateral; si topó un límite lo dice en la propia ficha, sin abrirlo.
 * Estados: reposo, agregado (rosa + palomita) y tope (texto de aviso).
 */
function AddChip({ item, label, priceCents, ariaLabel, stacked = false }: AddChipProps) {
  const [state, setState] = useState<ChipState>("idle");
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function flash(next: ChipState) {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setState("idle");
      setLimitMessage(null);
    }, FEEDBACK_MS);
  }

  function handleClick() {
    const result = addCartItem(item, 1);
    const message = describeAddOutcome(result.outcome, item.itemType);
    setLimitMessage(message);

    if (result.changed) {
      openCartPanel();
      flash("added");
    } else if (message) {
      flash("limit");
    }
  }

  const added = state === "added";
  const limit = state === "limit";

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={handleClick}
        className={`text-body-sm flex min-w-0 cursor-pointer rounded-md border px-2 py-1.5 text-foreground transition-[background-color,border-color,opacity] duration-[var(--duration-fast)] ease-out-quart focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
          added
            ? "border-primary-action bg-primary"
            : "border-border-strong bg-surface/70 hover:border-primary-action hover:bg-primary"
        } ${stacked ? "flex-col items-center justify-center text-center leading-tight" : "items-center justify-between gap-3"}`}
      >
        {added ? (
          <span className="mx-auto flex items-center gap-2 font-medium">
            <Check size={16} weight="bold" aria-hidden="true" />
            Agregado
          </span>
        ) : limit ? (
          <span className="mx-auto font-medium">Ya tienes el máximo</span>
        ) : (
          <>
            <span className="max-w-full truncate">{label}</span>
            <span className="font-medium">{formatMoneyMXN(priceCents)}</span>
          </>
        )}
      </button>
      <span role="status" className="sr-only">
        {added ? "Agregado al carrito" : (limitMessage ?? "")}
      </span>
    </>
  );
}

export { AddChip };
