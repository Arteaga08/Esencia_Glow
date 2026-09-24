"use client";

import { FloppyDisk, Trash } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { VariantDraft } from "./variant-fields";

interface VariantRowProps {
  draft: VariantDraft;
  onChange: (patch: Partial<VariantDraft>) => void;
  onRemove: () => void;
  /** Solo se pide al crear el producto — write-only, nunca en edición
   * (product-variant.service.ts: la subruta de agregar la ignora). */
  showInitialStock: boolean;
  /** Modo edición: cada fila tiene su propio botón Guardar que dispara la
   * llamada a la API de inmediato (el backend no acepta reemplazar el
   * arreglo completo de variantes — ver product.validator.ts). En alta,
   * no hay nada que guardar por fila: todo viaja junto en el POST final. */
  onSave?: () => void;
  saving?: boolean;
  errors?: Record<string, string>;
}

/**
 * Una fila de variante — usada tanto en el alta (arreglo local sin guardar
 * hasta el submit) como en la edición (cada campo persiste al backend por
 * su cuenta). Los campos son los mismos en los dos casos; lo que cambia es
 * quién decide cuándo se manda a la API.
 */
function VariantRow({
  draft,
  onChange,
  onRemove,
  showInitialStock,
  onSave,
  saving = false,
  errors,
}: VariantRowProps) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Input
          label="SKU"
          placeholder="SERUM-NIA-30ML"
          value={draft.sku}
          onChange={(e) => onChange({ sku: e.target.value.toUpperCase() })}
          error={errors?.sku}
        />
        <Input
          label="Nombre de variante"
          placeholder="30 ml"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          error={errors?.name}
        />
        <Input
          label="Precio (MXN)"
          type="number"
          step="0.01"
          placeholder="349.00"
          value={draft.price}
          onChange={(e) => onChange({ price: e.target.value })}
          error={errors?.price}
        />
        <Input
          label="Precio anterior (opcional)"
          type="number"
          step="0.01"
          placeholder="450.00"
          value={draft.listPrice}
          onChange={(e) => onChange({ listPrice: e.target.value })}
          error={errors?.listPrice}
          helper="Solo visual — el cobro siempre usa el precio de arriba."
        />
        <Input
          label="Peso (g)"
          type="number"
          placeholder="120"
          value={draft.weightGrams}
          onChange={(e) => onChange({ weightGrams: e.target.value })}
          error={errors?.weightGrams}
        />
        <Input
          label="Largo (cm)"
          type="number"
          step="0.1"
          placeholder="4.5"
          value={draft.length}
          onChange={(e) => onChange({ length: e.target.value })}
          error={errors?.["dimensionsCm.length"]}
        />
        <Input
          label="Ancho (cm)"
          type="number"
          step="0.1"
          placeholder="4.5"
          value={draft.width}
          onChange={(e) => onChange({ width: e.target.value })}
          error={errors?.["dimensionsCm.width"]}
        />
        <Input
          label="Alto (cm)"
          type="number"
          step="0.1"
          placeholder="12"
          value={draft.height}
          onChange={(e) => onChange({ height: e.target.value })}
          error={errors?.["dimensionsCm.height"]}
        />
        <Input
          label="Tamaño (opcional)"
          placeholder="30 ml"
          value={draft.size}
          onChange={(e) => onChange({ size: e.target.value })}
        />
        <Input
          label="Tono (opcional)"
          placeholder="Nude"
          value={draft.shade}
          onChange={(e) => onChange({ shade: e.target.value })}
        />
        <Input
          label="Volumen (opcional)"
          placeholder="30 ml"
          value={draft.volume}
          onChange={(e) => onChange({ volume: e.target.value })}
        />
        {showInitialStock ? (
          <Input
            label="Existencia inicial"
            type="number"
            placeholder="0"
            value={draft.initialStock}
            onChange={(e) => onChange({ initialStock: e.target.value })}
            helper="Solo al crear el producto."
          />
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <Switch
          checked={draft.isActive}
          onChange={(checked) => onChange({ isActive: checked })}
          label={`Variante ${draft.name || draft.sku} activa`}
        />
        <div className="flex items-center gap-2">
          {onSave ? (
            <Button type="button" variant="secondary" size="sm" onClick={onSave} loading={saving}>
              <FloppyDisk size={14} aria-hidden="true" />
              Guardar
            </Button>
          ) : null}
          <button
            type="button"
            onClick={onRemove}
            aria-label="Quitar variante"
            className="rounded-sm p-1.5 text-destructive-action hover:bg-destructive/30"
          >
            <Trash size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export { VariantRow };
