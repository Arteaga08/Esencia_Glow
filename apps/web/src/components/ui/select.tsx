"use client";

import { Check, CaretDown, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  helper?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * DESIGN.md §5 Select/Combobox: cerrado como Input con `CaretDown` 16px que
 * gira al abrir; menú overlay `shadow.overlay`, máx 320px con scroll; opción
 * resaltada `muted`, seleccionada `primary` + `Check`; vacío con Cuerpo
 * pequeño centrado. Listbox propio (no `<select>` nativo) porque el overlay
 * documentado no tiene equivalente nativo estilizable de forma consistente
 * entre navegadores.
 */
function Select({
  label,
  value,
  onChange,
  options,
  placeholder = "Selecciona una opción",
  error,
  helper,
  disabled = false,
  className = "",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const autoId = useId();
  const helperId = helper || error ? `${autoId}-helper` : undefined;
  const hasError = Boolean(error);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={"relative pt-2 " + className}>
      <button
        type="button"
        id={autoId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-describedby={helperId}
        onClick={() => setOpen((v) => !v)}
        className={
          "peer flex w-full items-center justify-between rounded-md border bg-input px-3 py-2.75 " +
          "text-left text-body text-foreground outline-none transition-colors duration-[var(--duration-fast)] " +
          "ease-out-quart " +
          (hasError
            ? "border-destructive-action focus:border-destructive-action"
            : "border-border-strong focus:border-primary-action") +
          (disabled ? " cursor-not-allowed bg-muted text-muted-foreground border-border" : "")
        }
      >
        <span className={selected ? "" : "text-muted-foreground"}>
          {selected ? selected.label : placeholder}
        </span>
        <CaretDown
          size={16}
          weight="regular"
          aria-hidden="true"
          className={
            "shrink-0 transition-transform duration-[var(--duration-fast)] ease-out-quart " +
            (open ? "rotate-180" : "")
          }
        />
      </button>
      <label
        htmlFor={autoId}
        className={
          "absolute top-2 left-3 -translate-y-1/2 px-1 font-mono text-label uppercase tracking-[0.06em] " +
          "transition-colors duration-[var(--duration-fast)] ease-out-quart " +
          (hasError
            ? "text-destructive-action"
            : disabled
              ? "text-muted-foreground"
              : "text-muted-foreground-strong peer-focus:text-primary-action")
        }
        style={{ background: "var(--surface-bg, var(--color-background))" }}
      >
        {label}
      </label>
      {open ? (
        <ul
          role="listbox"
          className={
            "absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-border " +
            "bg-surface py-1 shadow-[var(--shadow-overlay)]"
          }
        >
          {options.length === 0 ? (
            <li className="px-3 py-4 text-center text-body-sm text-muted-foreground">
              No hay opciones disponibles
            </li>
          ) : (
            options.map((option) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-body " +
                      (isSelected
                        ? "bg-primary text-foreground"
                        : "text-foreground hover:bg-muted")
                    }
                  >
                    {option.label}
                    {isSelected ? <Check size={16} weight="bold" aria-hidden="true" /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
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

export type { SelectProps, SelectOption };
export { Select };
