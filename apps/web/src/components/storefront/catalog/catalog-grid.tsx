"use client";

import { MagnifyingGlass, Package } from "@phosphor-icons/react";
import { EmptyState } from "@/components/ui/empty-state";
import { ShelfCard } from "@/components/storefront/home/shelf/shelf-card";
import { VIEW_ALL_BUTTON } from "@/components/storefront/home/shelf/shelf-button-styles";
import type { ShelfItem } from "@/lib/storefront/shelf-item";

interface CatalogGridProps {
  items: ShelfItem[];
  hasFilters: boolean;
  onClear: () => void;
}

/**
 * Rejilla de tarjetas del catálogo (2 columnas en móvil, 4 en escritorio).
 * Sin resultados distingue dos casos: filtros demasiado estrechos (se pueden
 * quitar) y categoría que todavía no tiene productos (no hay nada que quitar).
 */
function CatalogGrid({ items, hasFilters, onClear }: CatalogGridProps) {
  if (items.length === 0) {
    return hasFilters ? (
      <EmptyState
        icon={MagnifyingGlass}
        title="Ningún producto coincide"
        description="Prueba con otra marca o amplía el rango de precio."
        action={
          <button type="button" onClick={onClear} className={VIEW_ALL_BUTTON}>
            Quitar filtros
          </button>
        }
      />
    ) : (
      <EmptyState icon={Package} title="Aún no hay productos aquí" description="Vuelve pronto o explora otra categoría." />
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-12 lg:grid-cols-4">
      {items.map((item, index) => (
        <li key={item.id}>
          <ShelfCard item={item} priority={index < 4} />
        </li>
      ))}
    </ul>
  );
}

export { CatalogGrid };
