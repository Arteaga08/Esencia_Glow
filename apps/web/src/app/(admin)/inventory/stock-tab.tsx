"use client";

import { useState } from "react";
import { StockStatus } from "@esencia-glow/shared";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryInventorySection } from "@/components/inventory/category-inventory-section";
import { InventoryFilters } from "@/components/inventory/inventory-filters";
import { useCategoryTree } from "@/components/inventory/use-category-tree";
import { useDebouncedValue } from "@/components/inventory/use-debounced-value";
import type { InventorySort } from "@/components/inventory/use-inventory-list";
import { useInitialQueryParam } from "@/lib/hooks/use-initial-query-param";

const VALID_STOCK_STATUSES: string[] = Object.values(StockStatus);

/** `?status=out|low` desde la tarjeta de Inventario del Resumen (Milestone
 * 2.9) — solo un valor válido del enum entra, cualquier otra cosa (o nada)
 * cae al filtro por default. */
function resolveInitialStatus(raw: string | null): StockStatus | null {
  return raw && VALID_STOCK_STATUSES.includes(raw) ? (raw as StockStatus) : null;
}

/**
 * Existencias: un bloque por categoría raíz, cada uno con su propia petición
 * y paginación. `refreshSignal` es compartido: un ajuste puede cambiar el
 * estado de un producto y con él los conteos del encabezado de su grupo.
 */
function StockTab() {
  const { groups, loadError, retry } = useCategoryTree();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const initialStatus = useInitialQueryParam("status");
  const [status, setStatus] = useState<StockStatus | null>(() => resolveInitialStatus(initialStatus));
  const [sort, setSort] = useState<InventorySort>("totalAvailable");
  const [refreshSignal, setRefreshSignal] = useState(0);

  const isFiltered = Boolean(debouncedSearch) || status !== null;
  const bumpRefresh = () => setRefreshSignal((value) => value + 1);

  return (
    <div>
      <p className="mb-6 text-body text-muted-foreground-strong">
        Existencias por categoría. Solo se abren las que tienen algo que surtir.
      </p>
      <InventoryFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        sort={sort}
        onSortChange={setSort}
      />
      {loadError ? (
        <ErrorState description={loadError} onRetry={retry} />
      ) : groups === null ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(({ root }) => (
            <CategoryInventorySection
              key={root.id}
              category={root}
              filters={{ search: debouncedSearch, status, sort }}
              isFiltered={isFiltered}
              refreshSignal={refreshSignal}
              onChanged={bumpRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export { StockTab };
