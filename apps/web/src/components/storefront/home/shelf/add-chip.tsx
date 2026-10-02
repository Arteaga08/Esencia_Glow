"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { formatMoneyMXN } from "@/lib/format-money";

type ChipState = "idle" | "loading" | "added";

const SIMULATED_REQUEST_MS = 600;
const ADDED_FEEDBACK_MS = 1800;

interface AddChipProps {
  label: string;
  priceCents: number;
  /** Texto accesible completo, p. ej. "Agregar Sérum, 30 ml". */
  ariaLabel: string;
  /** Con varias fichas en fila no cabe etiqueta y precio lado a lado: se apilan. */
  stacked?: boolean;
}

/**
 * Ficha de presentación que además agrega al carrito: elegir la variante y
 * agregarla es un solo clic (sin botón aparte). Todavía no hay carrito: la
 * petición es simulada y no guarda nada; cuando exista, solo cambia `handleClick`.
 * Estados: reposo, cargando (ficha atenuada) y agregado (rosa + palomita).
 */
function AddChip({ label, priceCents, ariaLabel, stacked = false }: AddChipProps) {
  const [state, setState] = useState<ChipState>("idle");
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

  const added = state === "added";

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-busy={state === "loading"}
        onClick={handleClick}
        className={`text-body-sm flex min-w-0 rounded-md border px-2 py-1.5 text-foreground transition-[background-color,border-color,opacity] duration-[var(--duration-fast)] ease-out-quart focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
          added
            ? "border-primary-action bg-primary"
            : "border-border-strong bg-surface/70 hover:border-primary-action hover:bg-primary"
        } ${stacked ? "flex-col items-center justify-center text-center leading-tight" : "items-center justify-between gap-3"} ${
          state === "loading" ? "opacity-60" : ""
        }`}
      >
        {added ? (
          <span className="mx-auto flex items-center gap-2 font-medium">
            <Check size={16} weight="bold" aria-hidden="true" />
            Agregado
          </span>
        ) : (
          <>
            <span className="max-w-full truncate">{label}</span>
            <span className="font-medium">{formatMoneyMXN(priceCents)}</span>
          </>
        )}
      </button>
      <span role="status" className="sr-only">
        {added ? "Agregado al carrito" : ""}
      </span>
    </>
  );
}

export { AddChip };
