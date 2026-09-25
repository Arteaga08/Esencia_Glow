"use client";

import { Check } from "@phosphor-icons/react";
import {
  BADGE_COLOR_LABELS,
  BADGE_COLOR_VALUES,
  COLOR_CLASSES,
  type BadgeColorValue,
} from "@/components/ui/badge";

interface BadgeColorPickerProps {
  value: BadgeColorValue;
  onChange: (value: BadgeColorValue) => void;
  label?: string;
}

/**
 * No existe todavía un primitivo Checkbox/Radio en el sistema (DESIGN.md §5
 * lo documenta — 18×18px, marcado `primary-action`, halo de foco de 2px —
 * pero nadie lo había construido). Este picker es un radiogroup de swatches:
 * en vez de un punto neutro que se llena de `primary-action` al marcar, cada
 * opción YA es el color real de `BadgeColor` (la decisión que está tomando
 * el admin es justo cuál de esos 6 colores usar, así que ocultarlos detrás
 * de un radio neutro sería peor UX). La selección se marca con el mismo halo
 * de foco de 2px y un check superpuesto, nunca solo con el borde — el color
 * por sí solo no basta para quien no distingue bien el rosa del neutro.
 */
function BadgeColorPicker({ value, onChange, label = "Color" }: BadgeColorPickerProps) {
  return (
    <div>
      <p className="mb-2 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
        {label}
      </p>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
        {BADGE_COLOR_VALUES.map((color) => {
          const selected = color === value;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(color)}
              className={
                "flex flex-col items-center gap-1.5 rounded-md border px-2 py-2.5 " +
                "transition-colors duration-[var(--duration-fast)] ease-out-quart " +
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
                "focus-visible:outline-ring " +
                (selected ? "border-primary-action" : "border-border-strong hover:border-foreground")
              }
            >
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 items-center justify-center rounded-full ${COLOR_CLASSES[color]}`}
              >
                {selected ? <Check size={16} weight="bold" /> : null}
              </span>
              <span className="text-body-sm text-foreground">{BADGE_COLOR_LABELS[color]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { BadgeColorPickerProps };
export { BadgeColorPicker };
