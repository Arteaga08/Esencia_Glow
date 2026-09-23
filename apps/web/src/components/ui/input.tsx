"use client";

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

  return (
    <div className="relative pt-2">
      <input
        {...props}
        id={inputId}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={Boolean(error)}
        aria-describedby={helperId}
        className={
          "peer w-full rounded-md border px-3 py-2.75 text-body text-foreground outline-none " +
          "transition-colors duration-[var(--duration-fast)] ease-out-quart placeholder:text-muted-foreground " +
          (error
            ? "border-destructive-action focus:border-destructive-action"
            : "border-border-strong focus:border-primary-action") +
          (disabled ? " cursor-not-allowed bg-muted text-muted-foreground border-border" : "") +
          (readOnly && !disabled ? " bg-surface cursor-default" : disabled ? "" : " bg-input") +
          ` ${className}`
        }
      />
      <label
        htmlFor={inputId}
        className={
          "absolute -top-2.25 left-3 px-1 font-mono text-label uppercase tracking-[0.06em] " +
          "transition-colors duration-[var(--duration-fast)] ease-out-quart " +
          (error
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
          className={"mt-1.5 text-body-sm " + (error ? "text-destructive-action" : "text-muted-foreground-strong")}
        >
          {error ?? helper}
        </p>
      ) : null}
    </div>
  );
}

export type { InputProps };
export { Input };
