"use client";

import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductInventory } from "./use-product-inventory";
import { VariantStockRow } from "./variant-stock-row";

interface ProductVariantsPanelProps {
  productId: string;
  /** Avisa al listado que algo cambió: el estado y los conteos del grupo
   * pueden moverse con un ajuste. */
  onChanged: () => void;
}

/** Variantes de un producto abierto: se monta solo al expandir, así que el
 * detalle se pide una vez por apertura. */
function ProductVariantsPanel({ productId, onChanged }: ProductVariantsPanelProps) {
  const { detail, loadError, reload } = useProductInventory(productId);

  function handleChanged() {
    reload();
    onChanged();
  }

  if (loadError) return <ErrorState description={loadError} onRetry={reload} />;

  if (!detail) {
    return (
      <div className="flex flex-col gap-2 py-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <ul>
      {detail.variants.map((variant) => (
        <VariantStockRow key={variant.variantId} productId={productId} variant={variant} onChanged={handleChanged} />
      ))}
    </ul>
  );
}

export { ProductVariantsPanel };
