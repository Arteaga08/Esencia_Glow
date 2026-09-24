"use client";

import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface ContentItem {
  title: string;
  text: string;
}

interface ContentBlockEditorProps {
  label: string;
  items: ContentItem[];
  onChange: (items: ContentItem[]) => void;
  titlePlaceholder: string;
  textPlaceholder: string;
  /** Errores de campo de la API, ya acotados a este bloque (ej.
   * `{ "0.title": "..." }`) — el padre recorta el prefijo `content.ingredients.`
   * antes de pasarlos, así este componente es igual para los 4 bloques. */
  errors?: Record<string, string>;
}

/**
 * Uno de los cuatro bloques editoriales del producto (ingredientes, pasos de
 * rutina, modo de uso, beneficios) — todos la misma forma `{ title, text }`,
 * ver product-content.schema.ts. Reordenar es con flechas arriba/abajo, no
 * arrastrar: cubre el caso real (listas de un puñado de líneas) sin la
 * complejidad de drag-and-drop.
 */
function ContentBlockEditor({
  label,
  items,
  onChange,
  titlePlaceholder,
  textPlaceholder,
  errors,
}: ContentBlockEditorProps) {
  function updateItem(index: number, patch: Partial<ContentItem>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  function addItem() {
    onChange([...items, { title: "", text: "" }]);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">
          {label}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={addItem}>
          <Plus size={14} weight="bold" aria-hidden="true" />
          Agregar
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">Sin elementos todavía.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            // Las filas no tienen id propio (solo `{title, text}`), así que
            // la posición es la única key disponible mientras no se guardan.
            <div key={index} className="flex gap-2 rounded-md border border-border bg-surface p-3">
              <div className="flex flex-1 flex-col gap-2">
                <Input
                  label="Título"
                  placeholder={titlePlaceholder}
                  value={item.title}
                  onChange={(e) => updateItem(index, { title: e.target.value })}
                  error={errors?.[`${index}.title`]}
                />
                <Textarea
                  label="Texto"
                  placeholder={textPlaceholder}
                  value={item.text}
                  onChange={(e) => updateItem(index, { text: e.target.value })}
                  error={errors?.[`${index}.text`]}
                />
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  aria-label="Mover arriba"
                  className="rounded-sm p-1.5 text-muted-foreground-strong hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <ArrowUp size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label="Mover abajo"
                  className="rounded-sm p-1.5 text-muted-foreground-strong hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <ArrowDown size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  aria-label="Quitar"
                  className="rounded-sm p-1.5 text-destructive-action hover:bg-destructive/30"
                >
                  <Trash size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type { ContentItem };
export { ContentBlockEditor };
