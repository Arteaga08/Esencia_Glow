"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { useId, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helper?: string;
}

/**
 * Etiqueta de muesca (DESIGN.md §5, Inputs): el <label> se recorta sobre la
 * línea del borde, con `background: var(--surface-bg, …)` para taparla —
 * depende de que el ancestro (body, Card, Modal…) declare `--surface-bg`.
 */
function Input({ label, error, helper, id, className = "", disabled, readOnly, ...props }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helperId = helper || error ? `${inputId}-helper` : undefined;
  const hasError = Boolean(error);

  return (
    <div className="relative pt-2">
      <input
        {...props}
        id={inputId}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={hasError}
        aria-describedby={helperId}
        className={
          // El borde va en 1px, no en el 1.5px que pide DESIGN.md §5: Chrome
          // redondea hacia abajo todo `border-width` sub-pixel, así que 1.5px
          // se renderiza idéntico a 1px (medido a 1x y a 2x). Subirlo de
          // verdad obliga a 2px — decisión de diseño pendiente, no se asume.
          "peer w-full rounded-md border px-3 py-2.75 text-body text-foreground outline-none " +
          "transition-colors duration-[var(--duration-fast)] ease-out-quart placeholder:text-muted-foreground " +
          (hasError
            ? "border-destructive-action focus:border-destructive-action"
            : "border-border-strong focus:border-primary-action") +
          (disabled ? " cursor-not-allowed bg-muted text-muted-foreground border-border" : "") +
          (readOnly && !disabled ? " bg-surface cursor-default" : disabled ? "" : " bg-input") +
          ` ${className}`
        }
      />
      {/* La muesca se centra sobre la línea superior del borde del input
          (DESIGN.md §5). `top-2` la lleva al borde exacto — el wrapper tiene
          `pt-2`, así que ahí empieza el input — y `-translate-y-1/2` la centra
          sobre esa línea sin depender de la altura del texto (antes era un
          `-top-2.25` fijo que, medido contra el `pt-2`, dejaba la etiqueta 17px
          arriba: se leía como etiqueta apilada, no como muesca). */}
      <label
        htmlFor={inputId}
        className={
          "absolute top-2 left-3 -translate-y-1/2 px-1 font-mono text-label uppercase tracking-[0.06em] " +
          "transition-colors duration-[var(--duration-fast)] ease-out-quart " +
          (hasError
            ? "text-destructive-action"
            : disabled
              ? "text-muted-foreground"
              : "text-muted-foreground-strong peer-focus:text-primary-action")
        }
        style={{ background: "var(--surface-bg, var(--color-background))" }}
      >
        {label}
      </label>
      {helper || error ? (
        <p
          id={helperId}
          className={
            "mt-1.5 flex items-start gap-1.5 text-body-sm " +
            (error ? "text-destructive-action" : "text-muted-foreground-strong")
          }
        >
          {error ? (
            <WarningCircle size={16} weight="regular" className="mt-0.5 shrink-0" aria-hidden="true" />
          ) : null}
          {error ?? helper}
        </p>
      ) : null}
    </div>
  );
}

export type { InputProps };
export { Input };
