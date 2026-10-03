import type { PlanFormValue } from "./plan-form-value";

type PrepaidOffer = Pick<PlanFormValue, "offersQuarterly" | "offersAnnual">;

const OPTIONS: { key: keyof PrepaidOffer; label: string; description: string }[] = [
  {
    key: "offersQuarterly",
    label: "Trimestral",
    description: "Se cobran 3 meses de golpe; la caja llega cada mes.",
  },
  {
    key: "offersAnnual",
    label: "Anual",
    description: "Se cobran 12 meses de golpe; la caja llega cada mes.",
  },
];

interface BillingModeSelectorProps {
  value: PrepaidOffer;
  onChange: (patch: Partial<PrepaidOffer>) => void;
}

/**
 * Periodos de cobro extra al crear un plan (2.7b-2, ampliado en 3.1.7b): el
 * mensual siempre existe; el trimestral y el anual se suman con casillas
 * independientes. Casillas nativas (teclado y lector de pantalla gratis)
 * vestidas de opción; la marcada se señala con el borde `primary-action`, no
 * con fondo rosa: el rosa de superficie ya es del botón primario del
 * formulario (Regla del Listón).
 */
function BillingModeSelector({ value, onChange }: BillingModeSelectorProps) {
  return (
    <fieldset>
      {/* La sección que lo contiene ya se titula "Cobro" a la vista. */}
      <legend className="sr-only">Periodos de cobro además del mensual</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <label
            key={option.key}
            className={
              "flex min-h-11 cursor-pointer items-start gap-3 rounded-md border bg-surface px-3 py-2.5 " +
              "transition-colors duration-[var(--duration-fast)] ease-out-quart " +
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 " +
              (value[option.key]
                ? "border-primary-action"
                : "border-border-strong hover:bg-muted/40")
            }
          >
            <input
              type="checkbox"
              checked={value[option.key]}
              onChange={(e) => onChange({ [option.key]: e.target.checked })}
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
