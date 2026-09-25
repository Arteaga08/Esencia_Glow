"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useCatalogFilters } from "@/lib/hooks/use-catalog-filters";
import { formatMoneyMXN } from "@/lib/format-money";

interface BundleBaseFieldsValue {
  name: string;
  description: string;
  price: string;
  listPrice: string;
  badgeId: string | null;
}

interface BundleBaseFieldsProps {
  value: BundleBaseFieldsValue;
  onChange: (patch: Partial<BundleBaseFieldsValue>) => void;
  /** Suma de referencia de los componentes actuales — nunca se guarda, solo
   * ayuda a decidir el precio manual (ver bundle.model.ts: el precio del
   * paquete manda, ignora por completo el de sus componentes). */
  componentsSum: number;
  errors?: Record<string, string>;
}

/** Datos base del paquete — nombre, descripción, precio y badge. La
 * composición y el contenido editorial viven en sus propios bloques. */
function BundleBaseFields({ value, onChange, componentsSum, errors }: BundleBaseFieldsProps) {
  const { badgeOptions } = useCatalogFilters();

  const priceCents = useMemo(() => Math.round((Number(value.price) || 0) * 100), [value.price]);
  const savings = componentsSum - priceCents;

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Nombre"
        placeholder="Ritual Nocturno Completo"
        value={value.name}
        onChange={(e) => onChange({ name: e.target.value })}
        error={errors?.name}
      />
      <Textarea
        label="Descripción"
        placeholder="Limpieza, tratamiento y sellado para la rutina de noche, en un solo paquete."
        value={value.description}
        onChange={(e) => onChange({ description: e.target.value })}
        error={errors?.description}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Input
          label="Precio"
          type="number"
          min={0}
          step="0.01"
          placeholder="899.00"
          value={value.price}
          onChange={(e) => onChange({ price: e.target.value })}
          error={errors?.price}
        />
        <Input
          label="Precio anterior (opcional)"
          type="number"
          min={0}
          step="0.01"
          placeholder="1047.00"
          value={value.listPrice}
          onChange={(e) => onChange({ listPrice: e.target.value })}
          error={errors?.listPrice}
          helper="Se muestra tachado junto al precio. Déjalo vacío si no aplica."
        />
        <Select
          label="Badge (opcional)"
          value={value.badgeId ?? ""}
          onChange={(v) => onChange({ badgeId: v === "" ? null : v })}
          options={[{ value: "", label: "Sin badge" }, ...badgeOptions]}
          error={errors?.badgeId}
        />
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 p-3">
        <span className="text-body-sm text-muted-foreground-strong">
          Suma de componentes sueltos (solo referencia, no se guarda)
        </span>
        <span className="font-mono text-data tabular-nums text-foreground">{formatMoneyMXN(componentsSum)}</span>
      </div>
      {componentsSum > 0 && priceCents > 0 ? (
        <p
          className={"text-body-sm " + (savings >= 0 ? "text-secondary-foreground" : "text-accent-foreground-strong")}
        >
          {savings >= 0
            ? `El precio del paquete manda: ahorro de ${formatMoneyMXN(savings)} frente a comprar suelto.`
            : `El precio del paquete manda: ${formatMoneyMXN(Math.abs(savings))} por encima de comprar los componentes sueltos — puede ser intencional (edición limitada, empaque especial).`}
        </p>
      ) : null}
    </div>
  );
}

export type { BundleBaseFieldsValue };
export { BundleBaseFields };
