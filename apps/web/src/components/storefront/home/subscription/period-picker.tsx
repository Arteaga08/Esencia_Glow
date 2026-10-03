import type { PeriodView } from "../../../../lib/storefront/subscription-periods";

interface PeriodPickerProps {
  name: string;
  views: PeriodView[];
  selected: number;
  onSelect: (index: number) => void;
}

const FOCUS = "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring";

/** Pastillas de periodo accesibles: radios nativos ocultos y la etiqueta como control visible. */
function PeriodPicker({ name, views, selected, onSelect }: PeriodPickerProps) {
  return (
    <div role="radiogroup" aria-label="Periodo de pago" className="grid auto-cols-fr grid-flow-col gap-2">
      {views.map((view, index) => (
        <label
          key={view.key}
          className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-2 py-2.5 text-center transition-colors duration-[var(--duration-base)] ease-out-quart ${FOCUS} ${
            index === selected ? "border-primary-action bg-blush" : "border-border-strong bg-surface hover:bg-muted"
          }`}
        >
          <input
            type="radio"
            name={name}
            checked={index === selected}
            onChange={() => onSelect(index)}
            className="sr-only"
          />
          <span className="type-shop-cta text-foreground">{view.label}</span>
        </label>
      ))}
    </div>
  );
}

export { PeriodPicker };
