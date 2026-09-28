"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api";
import type { PanelVariantRow } from "@/lib/types/admin-inventory";
import { handleInventoryError } from "./handle-inventory-error";

type AdjustMode = "recount" | "delta";

const MODE_OPTIONS: { id: AdjustMode; label: string }[] = [
  { id: "recount", label: "Recuento" },
  { id: "delta", label: "Movimiento" },
];

interface AdjustStockFormProps {
  productId: string;
  variant: PanelVariantRow;
  /** Tras guardar o tras un 409: releer el detalle y el listado. */
  onChanged: () => void;
}

/**
 * Ajuste de existencias de una variante. Dos modos, exclusivos igual que en
 * el backend (`adjustStockSchema`: `onHand` XOR `delta`):
 * - Recuento: "conté 12 en el anaquel" → `onHand` absoluto.
 * - Movimiento: "llegaron 24" / "se rompieron 2" → `delta` relativo.
 * `expectedOnHand` viaja siempre con la última cifra leída, así que si otra
 * pestaña ya movió el stock el backend responde 409 en vez de pisarlo.
 * Variante sin fila (`inventoryItemId === null`) → alta al vuelo con
 * `POST /admin/inventory`; ahí solo tiene sentido la existencia inicial.
 */
function AdjustStockForm({ productId, variant, onChanged }: AdjustStockFormProps) {
  const { toast } = useToast();
  const isUntracked = variant.inventoryItemId === null;
  const [mode, setMode] = useState<AdjustMode>("recount");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const effectiveMode: AdjustMode = isUntracked ? "recount" : mode;

  function parseQuantity(): number | null {
    const trimmed = quantity.trim();
    const value = Number(trimmed);
    if (trimmed === "" || !Number.isInteger(value)) {
      setFieldError("Escribe un número entero.");
      return null;
    }
    if (effectiveMode === "recount" && value < 0) {
      setFieldError("El recuento no puede ser negativo.");
      return null;
    }
    if (effectiveMode === "delta" && value === 0) {
      setFieldError("Un movimiento de 0 no cambia nada.");
      return null;
    }
    setFieldError(null);
    return value;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = parseQuantity();
    if (value === null) return;

    setSaving(true);
    setConflict(null);
    try {
      if (isUntracked) {
        await apiRequest("/api/v1/admin/inventory", {
          method: "POST",
          authenticated: true,
          body: { productId, variantId: variant.variantId, onHand: value },
        });
      } else {
        await apiRequest(`/api/v1/admin/inventory/${variant.variantId}/stock`, {
          method: "PATCH",
          authenticated: true,
          body: {
            ...(effectiveMode === "recount" ? { onHand: value } : { delta: value }),
            ...(reason.trim() ? { reason: reason.trim() } : {}),
            expectedOnHand: variant.onHand ?? undefined,
          },
        });
      }
      toast({ variant: "success", title: "Existencia actualizada", description: variant.sku });
      setQuantity("");
      setReason("");
      onChanged();
    } catch (error) {
      handleInventoryError({ error, setConflict, toast, title: "No se pudo ajustar la existencia", refresh: onChanged });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      {isUntracked ? (
        <p className="text-body-sm text-muted-foreground-strong">
          Esta variante todavía no tiene existencia registrada. Captura cuántas unidades hay.
        </p>
      ) : (
        <div role="group" aria-label="Tipo de ajuste" className="flex gap-1">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={mode === option.id}
              onClick={() => {
                setMode(option.id);
                setFieldError(null);
              }}
              className={
                "rounded-md px-3 py-1.5 text-body-sm transition-colors duration-[var(--duration-fast)] " +
                (mode === option.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground-strong hover:bg-muted/60 hover:text-foreground")
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-start gap-3">
        <div className="w-36">
          <Input
            label={isUntracked ? "Existencia" : effectiveMode === "recount" ? "Hay en total" : "Entra o sale"}
            type="number"
            inputMode="numeric"
            placeholder={effectiveMode === "recount" ? "12" : "+24 o -2"}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            error={fieldError ?? undefined}
          />
        </div>
        {isUntracked ? null : (
          <div className="w-64">
            <Input
              label="Motivo (opcional)"
              placeholder={effectiveMode === "recount" ? "Conteo de fin de mes" : "Llegó pedido del proveedor"}
              maxLength={200}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        )}
        <div className="pt-2">
          <Button type="submit" variant="secondary" size="sm" loading={saving}>
            {isUntracked ? "Registrar" : "Aplicar"}
          </Button>
        </div>
      </div>
      {conflict ? <FieldError message={conflict} /> : null}
    </form>
  );
}

export { AdjustStockForm };
