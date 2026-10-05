import { Minus, Plus } from "@phosphor-icons/react";
import { FOCUS } from "./product-styles";

interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

const BUTTON = `flex h-full w-11 cursor-pointer items-center justify-center text-foreground transition-colors duration-[var(--duration-fast)] ease-out-quart hover:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground ${FOCUS}`;

/** Selector de cantidad: menos, número y más. Los topes deshabilitan el botón, no lo ocultan. */
function QuantityStepper({ value, min = 1, max = 10, onChange }: QuantityStepperProps) {
  return (
    <div role="group" aria-label="Cantidad" className="flex h-12 items-stretch rounded-md border border-border-strong bg-surface">
      <button type="button" aria-label="Quitar una unidad" disabled={value <= min} onClick={() => onChange(value - 1)} className={`${BUTTON} rounded-l-md`}>
        <Minus size={16} aria-hidden="true" />
      </button>
      <output aria-live="polite" className="flex w-10 items-center justify-center font-mono text-data tabular-nums text-foreground">
        {value}
      </output>
      <button type="button" aria-label="Agregar una unidad" disabled={value >= max} onClick={() => onChange(value + 1)} className={`${BUTTON} rounded-r-md`}>
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export { QuantityStepper };
