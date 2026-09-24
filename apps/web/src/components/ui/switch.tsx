"use client";

import { useId } from "react";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Etiqueta accesible — el switch nunca lleva texto visible propio; el
   * texto que lo describe vive afuera (columna de tabla, fila de tarjeta). */
  label: string;
  disabled?: boolean;
  className?: string;
}

/**
 * `role="switch"` propio en vez de un `<input type="checkbox">` escondido:
 * el control visual (perilla que se desliza) no tiene equivalente HTML
 * nativo, y el rol ARIA es el contrato de accesibilidad correcto aquí.
 */
function Switch({ checked, onChange, label, disabled = false, className = "" }: SwitchProps) {
  const id = useId();

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors " +
        "duration-[var(--duration-fast)] ease-out-quart focus-visible:outline focus-visible:outline-2 " +
        "focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 " +
        (checked ? "bg-primary-action" : "bg-border-strong") +
        ` ${className}`
      }
    >
      <span
        aria-hidden="true"
        className={
          "inline-block h-4.5 w-4.5 rounded-full bg-surface transition-transform " +
          "duration-[var(--duration-fast)] ease-out-quart " +
          (checked ? "translate-x-5" : "translate-x-1")
        }
      />
    </button>
  );
}

export type { SwitchProps };
export { Switch };
