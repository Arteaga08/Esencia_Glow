"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { MAX_PLAN_HIGHLIGHTS, MAX_PLAN_HIGHLIGHT_LENGTH } from "@esencia-glow/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PlanHighlightsEditorProps {
  value: string[];
  onChange: (highlights: string[]) => void;
  /** Errores de Joi por ruta: `highlights` (lista entera) y `highlights.N`. */
  errors: Record<string, string>;
}

/**
 * Viñetas de "qué incluye" del plan (2.7c): hasta 6 líneas cortas que el
 * catálogo público pinta junto al precio. Las vacías se descartan al enviar
 * (plan-form-value.ts), así que dejar una fila en blanco no es un error.
 */
function PlanHighlightsEditor({ value, onChange, errors }: PlanHighlightsEditorProps) {
  const canAdd = value.length < MAX_PLAN_HIGHLIGHTS;

  function updateAt(index: number, text: string) {
    onChange(value.map((current, position) => (position === index ? text : current)));
  }

  function removeAt(index: number) {
    onChange(value.filter((_, position) => position !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length === 0 ? (
        <p className="text-body-sm text-muted-foreground-strong">
          Todavía no hay viñetas. Agrega lo que la clienta recibe con este plan.
        </p>
      ) : null}
      {value.map((text, index) => (
        <div key={index} className="flex items-start gap-2">
          <Input
            label={`Viñeta ${index + 1}`}
            placeholder="4 a 6 productos de tamaño completo cada mes"
            value={text}
            onChange={(e) => updateAt(index, e.target.value)}
            error={errors[`highlights.${index}`]}
            maxLength={MAX_PLAN_HIGHLIGHT_LENGTH}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => removeAt(index)}
            aria-label={`Quitar viñeta ${index + 1}`}
            className="mt-7 cursor-pointer rounded-sm p-1.5 text-destructive-action hover:bg-destructive/30"
          >
            <Trash size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
      {errors.highlights ? (
        <p className="text-body-sm text-destructive-action">{errors.highlights}</p>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={!canAdd}
        onClick={() => onChange([...value, ""])}
        className="self-start"
      >
        <Plus size={16} weight="bold" aria-hidden="true" />
        {canAdd ? "Agregar viñeta" : `Máximo ${MAX_PLAN_HIGHLIGHTS} viñetas`}
      </Button>
    </div>
  );
}

export { PlanHighlightsEditor };
