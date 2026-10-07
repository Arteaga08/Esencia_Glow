"use client";

import { Tag } from "@phosphor-icons/react";
import type { KeyboardEvent } from "react";
import type { CouponPreview } from "@esencia-glow/shared";
import { COUPON_CODE_MAX_LENGTH } from "@esencia-glow/shared";
import { Input } from "@/components/ui/input";
import { CTA_SECONDARY, LABEL, TEXT_LINK } from "../cart/cta-styles";

interface CouponFieldProps {
  input: string;
  applied: CouponPreview | null;
  error: string | null;
  pending: boolean;
  onInput: (value: string) => void;
  onApply: () => void;
  onRemove: () => void;
}

/**
 * Campo de cupón del resumen. Sin cupón: campo + "Aplicar", con el error pegado
 * al campo (el botón de pagar no se toca). Con cupón: el código y su
 * descuento, y "Quitar". Enter aplica sin enviar ningún formulario que lo
 * envuelva. El monto del descuento lo trae el servidor: aquí no se calcula.
 */
function CouponField({ input, applied, error, pending, onInput, onApply, onRemove }: CouponFieldProps) {
  if (applied) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-md border border-primary-action bg-blush px-4 py-3">
        <div className="flex min-w-0 items-start gap-2">
          <Tag size={20} weight="regular" aria-hidden="true" className="mt-0.5 shrink-0 text-foreground" />
          <div className="min-w-0">
            <p className="font-mono text-data text-foreground break-all">{applied.code}</p>
            <p className="text-body-sm text-muted-foreground-strong">{applied.label}</p>
          </div>
        </div>
        <button type="button" onClick={onRemove} className={TEXT_LINK} aria-label={`Quitar el cupón ${applied.code}`}>
          Quitar
        </button>
      </div>
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!pending) onApply();
  }

  return (
    <div>
      <p className={`mb-1 ${LABEL}`}>¿Tienes un cupón?</p>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Input
            label="Código"
            value={input}
            onChange={(event) => onInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="BIENVENIDA10"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={COUPON_CODE_MAX_LENGTH + 8}
            disabled={pending}
            {...(error ? { error } : {})}
          />
        </div>
        <button
          type="button"
          onClick={onApply}
          disabled={pending || input.trim() === ""}
          className={`${CTA_SECONDARY} mt-2 shrink-0 disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {pending ? "Revisando…" : "Aplicar"}
        </button>
      </div>
    </div>
  );
}

export { CouponField };
