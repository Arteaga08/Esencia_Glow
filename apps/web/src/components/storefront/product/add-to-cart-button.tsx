"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { formatMoneyMXN } from "@/lib/format-money";
import { FOCUS } from "./product-styles";

type ButtonState = "idle" | "loading" | "added";

const SIMULATED_REQUEST_MS = 600;
const ADDED_FEEDBACK_MS = 1800;

interface AddToCartButtonProps {
  totalCents: number;
  available: boolean;
  /** Texto accesible completo, p. ej. "Agregar 2 Sérum Vitamina C, 30 ml". */
  ariaLabel: string;
  className?: string;
}

/**
 * Botón de agregar. Todavía no hay carrito: la petición es simulada (igual que
 * `AddChip` del estante) y no guarda nada; cuando exista solo cambia `handleClick`.
 * Estados: reposo, cargando, agregado (palomita) y agotado (deshabilitado con texto).
 */
function AddToCartButton({ totalCents, available, ariaLabel, className = "" }: AddToCartButtonProps) {
  const [state, setState] = useState<ButtonState>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  function handleClick() {
    if (state !== "idle") return;
    setState("loading");
    timers.current.push(
      setTimeout(() => {
        setState("added");
        timers.current.push(setTimeout(() => setState("idle"), ADDED_FEEDBACK_MS));
      }, SIMULATED_REQUEST_MS),
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={available ? ariaLabel : "Producto agotado"}
        aria-busy={state === "loading"}
        disabled={!available}
        onClick={handleClick}
        className={`flex h-12 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-md border px-6 type-shop-cta text-foreground transition-[background-color,border-color,opacity,transform] duration-[var(--duration-base)] ease-out-quart active:scale-[0.98] disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground-strong ${FOCUS} ${
          state === "added" ? "border-primary-action bg-blush" : "border-primary-action bg-primary hover:bg-blush"
        } ${state === "loading" ? "opacity-60" : ""} ${className}`}
      >
        {!available ? (
          "Agotado"
        ) : state === "added" ? (
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
        {state === "added" ? "Agregado al carrito" : ""}
      </span>
    </>
  );
}

export { AddToCartButton };
