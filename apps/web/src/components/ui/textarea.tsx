"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { useId, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helper?: string;
}

/**
 * Mismo patrón de etiqueta de muesca que Input (DESIGN.md §5) — DESIGN.md
 * agrupa Textarea con Inputs, así que comparte estilo de borde/foco/error en
 * vez de definir uno propio.
 */
function Textarea({
  label,
  error,
  helper,
  id,
  className = "",
  disabled,
  ...props
}: TextareaProps) {
  const autoId = useId();
  const textareaId = id ?? autoId;
  const helperId = helper || error ? `${textareaId}-helper` : undefined;
  const hasError = Boolean(error);

  return (
    <div className="relative pt-2">
      <textarea
        {...props}
        id={textareaId}
        disabled={disabled}
        aria-invalid={hasError}
        aria-describedby={helperId}
        className={
          "peer min-h-24 w-full resize-y rounded-md border px-3 py-2.75 text-body text-foreground outline-none " +
          "transition-colors duration-[var(--duration-fast)] ease-out-quart placeholder:text-muted-foreground " +
          (hasError
            ? "border-destructive-action focus:border-destructive-action"
            : "border-border-strong focus:border-primary-action") +
          (disabled ? " cursor-not-allowed bg-muted text-muted-foreground border-border" : " bg-input") +
          ` ${className}`
        }
      />
      <label
        htmlFor={textareaId}
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

export type { TextareaProps };
export { Textarea };
