"use client";

import { Check, WarningCircle } from "@phosphor-icons/react";
import { useId, type ReactNode } from "react";

interface CheckboxFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  children: ReactNode;
}

/**
 * Casilla con caja de 24px (zona táctil de 44px con el renglón completo). El
 * `input` nativo queda visible a los lectores y al teclado; la caja es solo su
 * cara. El error va debajo, pegado a la casilla.
 */
function CheckboxField({ checked, onChange, error, children }: CheckboxFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-1.5">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors duration-[var(--duration-fast)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring ${
            checked ? "border-primary-action bg-primary text-foreground" : error ? "border-destructive-action bg-input" : "border-border-strong bg-input"
          }`}
        >
          {checked ? <Check size={14} weight="bold" /> : null}
        </span>
        <span className="text-body text-foreground">{children}</span>
      </label>
      {error ? (
        <p id={errorId} role="alert" className="mt-0.5 flex items-start gap-1.5 text-body-sm text-destructive-action">
          <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { CheckboxField };
