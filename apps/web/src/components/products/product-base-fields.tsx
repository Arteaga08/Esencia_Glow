"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useCatalogFilters } from "@/lib/hooks/use-catalog-filters";

interface ProductBaseFieldsValue {
  name: string;
  description: string;
  shortDescription: string;
  categoryId: string | null;
  badgeId: string | null;
  channel: "store" | "subscription";
}

interface ProductBaseFieldsProps {
  value: ProductBaseFieldsValue;
  onChange: (patch: Partial<ProductBaseFieldsValue>) => void;
  errors?: Record<string, string>;
}

const CHANNEL_OPTIONS = [
  { value: "store", label: "Tienda" },
  { value: "subscription", label: "Suscripción (caja curada)" },
];

/** Datos base del producto — el cascarón. Variantes, fotos y contenido
 * editorial viven en sus propios bloques del editor, no aquí. */
function ProductBaseFields({ value, onChange, errors }: ProductBaseFieldsProps) {
  const { categoryOptions, badgeOptions } = useCatalogFilters();

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Nombre"
        placeholder="Sérum de niacinamida 10%"
        value={value.name}
        onChange={(e) => onChange({ name: e.target.value })}
        error={errors?.name}
      />
      <Input
        label="Descripción corta (opcional)"
        placeholder="Reduce poros visibles y empareja el tono en 4 semanas"
        value={value.shortDescription}
        onChange={(e) => onChange({ shortDescription: e.target.value })}
        error={errors?.shortDescription}
      />
      <Textarea
        label="Descripción"
        placeholder="Describe la textura, el aroma, para qué tipo de piel es y qué resultado esperar…"
        value={value.description}
        onChange={(e) => onChange({ description: e.target.value })}
        error={errors?.description}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Select
          label="Categoría"
          value={value.categoryId}
          onChange={(v) => onChange({ categoryId: v })}
          options={categoryOptions}
          placeholder="Elige una categoría"
          error={errors?.categoryId}
        />
        <Select
          label="Badge (opcional)"
          value={value.badgeId ?? ""}
          onChange={(v) => onChange({ badgeId: v === "" ? null : v })}
          options={[{ value: "", label: "Sin badge" }, ...badgeOptions]}
          error={errors?.badgeId}
        />
        <Select
          label="Canal"
          value={value.channel}
          onChange={(v) => onChange({ channel: v as "store" | "subscription" })}
          options={CHANNEL_OPTIONS}
          error={errors?.channel}
        />
      </div>
    </div>
  );
}

export type { ProductBaseFieldsValue };
export { ProductBaseFields };
