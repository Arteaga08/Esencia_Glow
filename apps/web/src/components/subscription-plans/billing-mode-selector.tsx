import { useId } from "react";
import type { BillingMode } from "./plan-form-value";

const OPTIONS: { value: BillingMode; label: string; description: string }[] = [
  { value: "monthly", label: "Solo mensual", description: "Se cobra cada mes." },
  {
    value: "monthly_and_annual",
    label: "Mensual y anual",
    description: "La clienta elige: cada mes o 12 meses de golpe.",
  },
];

interface BillingModeSelectorProps {
  value: BillingMode;
  onChange: (value: BillingMode) => void;
}

/**
 * Selector de modalidad de cobro al crear un plan (2.7b-2). Radios nativos
 * (teclado y lector de pantalla gratis) vestidos de opción; la seleccionada
 * se marca con el borde `primary-action`, no con fondo rosa: el rosa de
 * superficie ya es del botón primario del formulario (Regla del Listón).
 */
function BillingModeSelector({ value, onChange }: BillingModeSelectorProps) {
  const name = useId();

  return (
    <fieldset>
      {/* La sección que lo contiene ya se titula "Cobro" a la vista. */}
      <legend className="sr-only">Modalidad de cobro</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border bg-surface px-3 py-2.5 " +
              "transition-colors duration-[var(--duration-fast)] ease-out-quart " +
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 " +
              (value === option.value
                ? "border-primary-action"
                : "border-border-strong hover:bg-muted/40")
            }
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--color-primary-action)]"
            />
            <span>
              <span className="block text-body text-foreground">{option.label}</span>
              <span className="block text-body-sm text-muted-foreground-strong">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export { BillingModeSelector };
