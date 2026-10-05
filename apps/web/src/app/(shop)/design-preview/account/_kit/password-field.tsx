"use client";

import { Check, Circle, Eye, EyeSlash } from "@phosphor-icons/react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { PASSWORD_RULES, STRENGTH_LABELS, strengthScore } from "./password";
import { FOCUS } from "./styles";

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  autoComplete: "current-password" | "new-password";
  /** Medidor de fortaleza y lista de reglas bajo el campo (solo al crear o cambiar). */
  showStrength?: boolean;
  helper?: string;
  name?: string;
}

/**
 * Campo de contraseña con ojo para mostrarla. En modo de alta suma el medidor
 * de cuatro tramos y la lista de reglas que se van cumpliendo mientras se
 * escribe: el error nunca llega de golpe, la persona ve qué le falta.
 */
function PasswordField({ label, value, onChange, error, placeholder, autoComplete, showStrength = false, helper, name }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const score = strengthScore(value);

  return (
    <div>
      <div className="relative">
        <Input
          label={label}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          error={error}
          helper={showStrength ? undefined : helper}
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
          className={`absolute top-[11px] right-1 flex size-10 cursor-pointer items-center justify-center rounded-md text-muted-foreground-strong transition-colors duration-[var(--duration-fast)] hover:text-foreground ${FOCUS}`}
        >
          {visible ? <EyeSlash size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>

      {showStrength ? (
        <div className="mt-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 gap-1" aria-hidden="true">
              {[1, 2, 3, 4].map((step) => (
                <span
                  key={step}
                  className={`h-1 flex-1 rounded-full transition-colors duration-[var(--duration-base)] ${
                    step <= score ? (score === 4 ? "bg-secondary-foreground" : "bg-primary-action") : "bg-border-strong/40"
                  }`}
                />
              ))}
            </div>
            <span aria-live="polite" className="w-14 text-right font-mono text-label uppercase text-muted-foreground-strong">
              {STRENGTH_LABELS[score]}
            </span>
          </div>
          <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {PASSWORD_RULES.map((rule) => {
              const met = rule.met(value);
              return (
                <li key={rule.key} className={`flex items-center gap-1.5 text-body-sm ${met ? "text-secondary-foreground" : "text-muted-foreground-strong"}`}>
                  {met ? <Check size={14} weight="bold" aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
                  <span>{rule.label}</span>
                  <span className="sr-only">{met ? ", cumplida" : ", pendiente"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export { PasswordField };
