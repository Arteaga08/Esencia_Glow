"use client";

import { WarningCircle, X } from "@phosphor-icons/react";
import { useId, useState, type KeyboardEvent } from "react";
import { addTags, hasTag } from "./tag-list";

interface TagInputProps {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  /** Etiquetas ya usadas en otros registros: se ofrecen para agregarlas con un clic. */
  suggestions?: string[];
  placeholder?: string;
  helper?: string;
  error?: string;
  maxTags?: number;
  maxLength?: number;
}

/**
 * Campo de etiquetas de texto libre: se escribe y se confirma con Enter o
 * coma; Retroceso con el campo vacío quita la última. Misma etiqueta de
 * muesca que `Input` (DESIGN.md §5). Lo que quede escrito sin confirmar se
 * agrega al salir del campo, para que "Guardar" no lo pierda.
 */
function TagInput({
  label,
  value,
  onChange,
  suggestions = [],
  placeholder,
  helper,
  error,
  maxTags = 10,
  maxLength = 40,
}: TagInputProps) {
  const inputId = useId();
  const helperId = helper || error ? `${inputId}-helper` : undefined;
  const [draft, setDraft] = useState("");
  const hasError = Boolean(error);
  const isFull = value.length >= maxTags;
  const available = suggestions.filter((suggestion) => !hasTag(value, suggestion));

  function commit(raw: string) {
    const next = addTags(value, raw, suggestions, maxTags, maxLength);
    if (next.length !== value.length) onChange(next);
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      // Enter no debe enviar el formulario del producto.
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="relative pt-2">
      <div
        className={
          "flex w-full flex-wrap items-center gap-1.5 rounded-md border bg-input px-3 py-2 " +
          "transition-colors duration-[var(--duration-fast)] ease-out-quart " +
          (hasError
            ? "border-destructive-action"
            : "border-border-strong focus-within:border-primary-action")
        }
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-muted py-0.75 pr-1.5 pl-2.5 text-body-sm text-foreground"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((current) => current !== tag))}
              aria-label={`Quitar ${tag}`}
              className="flex size-4 cursor-pointer items-center justify-center rounded-full text-muted-foreground-strong hover:text-foreground"
            >
              <X size={12} weight="bold" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(draft)}
          disabled={isFull}
          maxLength={maxLength}
          placeholder={isFull ? "" : placeholder}
          aria-invalid={hasError}
          aria-describedby={helperId}
          className="min-w-32 flex-1 bg-transparent py-0.75 text-body text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      <label
        htmlFor={inputId}
        className={
          "absolute top-2 left-3 -translate-y-1/2 px-1 font-mono text-label uppercase tracking-[0.06em] " +
          (hasError ? "text-destructive-action" : "text-muted-foreground-strong")
        }
        style={{ background: "var(--surface-bg, var(--color-background))" }}
      >
        {label}
      </label>
      {available.length > 0 && !isFull ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-body-sm text-muted-foreground-strong">Ya usados:</span>
          {available.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => commit(suggestion)}
              className="cursor-pointer rounded-full border border-border-strong px-2.5 py-0.75 text-body-sm text-foreground hover:bg-muted"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      ) : null}
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

export type { TagInputProps };
export { TagInput };
