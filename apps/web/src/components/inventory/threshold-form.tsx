"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api";
import type { PanelVariantRow } from "@/lib/types/admin-inventory";
import { handleInventoryError } from "./handle-inventory-error";

interface ThresholdFormProps {
  variant: PanelVariantRow;
  onChanged: () => void;
}

/**
 * Umbral de stock bajo por variante (`PATCH /admin/inventory/:variantId`).
 * Vacío = sin override: `lowStockThreshold: null` hace `$unset` y la
 * variante vuelve al umbral global de Ajustes. El umbral efectivo lo
 * resuelve siempre el servidor; aquí solo se muestra.
 */
function ThresholdForm({ variant, onChanged }: ThresholdFormProps) {
  const { toast } = useToast();
  const [value, setValue] = useState(variant.lowStockThreshold === null ? "" : String(variant.lowStockThreshold));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hasOverride = variant.lowStockThreshold !== null;
  const helper = hasOverride
    ? `Propio de esta variante. Vacío para volver al general.`
    : `Usa el general de la tienda (${variant.effectiveLowStockThreshold}).`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    if (trimmed !== "" && (!Number.isInteger(parsed) || parsed < 0)) {
      setFieldError("Escribe un entero mayor o igual a 0, o déjalo vacío.");
      return;
    }
    setFieldError(null);

    setSaving(true);
    setConflict(null);
    try {
      await apiRequest(`/api/v1/admin/inventory/${variant.variantId}`, {
        method: "PATCH",
        authenticated: true,
        body: { lowStockThreshold: trimmed === "" ? null : parsed },
      });
      toast({ variant: "success", title: "Umbral actualizado", description: variant.sku });
      onChanged();
    } catch (error) {
      handleInventoryError({ error, setConflict, toast, title: "No se pudo cambiar el umbral", refresh: onChanged });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-wrap items-start gap-3">
        <div className="w-44">
          <Input
            label="Avisar al llegar a"
            type="number"
            inputMode="numeric"
            placeholder={String(variant.effectiveLowStockThreshold)}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            error={fieldError ?? undefined}
            helper={helper}
          />
        </div>
        <div className="pt-2">
          <Button type="submit" variant="secondary" size="sm" loading={saving}>
            Guardar umbral
          </Button>
        </div>
      </div>
      {conflict ? <FieldError message={conflict} /> : null}
    </form>
  );
}

export { ThresholdForm };
