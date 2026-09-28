"use client";

import { StockStatus } from "@esencia-glow/shared";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { InventorySort } from "./use-inventory-list";
import { STOCK_STATUS_BADGE } from "./stock-status";

const ALL_STATUSES = "all";

const STATUS_OPTIONS = [
  { value: ALL_STATUSES, label: "Todos" },
  ...[StockStatus.OUT, StockStatus.LOW, StockStatus.OK, StockStatus.UNTRACKED].map((status) => ({
    value: status,
    label: STOCK_STATUS_BADGE[status].label,
  })),
];

const SORT_OPTIONS: { value: InventorySort; label: string }[] = [
  { value: "totalAvailable", label: "Menos disponible primero" },
  { value: "name", label: "Nombre (A-Z)" },
  { value: "-updatedAt", label: "Editado recientemente" },
];

interface InventoryFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: StockStatus | null;
  onStatusChange: (value: StockStatus | null) => void;
  sort: InventorySort;
  onSortChange: (value: InventorySort) => void;
}

/** Buscador (nombre o SKU, igual que el backend) + estado + orden, en la
 * misma fila y con anchos fijos como en Pedidos. */
function InventoryFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
}: InventoryFiltersProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="w-72">
        <Input
          label="Buscar"
          placeholder="Sérum Vitamina C o LS-150ML"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <div className="w-48">
        <Select
          label="Estado"
          value={status ?? ALL_STATUSES}
          onChange={(value) => onStatusChange(value === ALL_STATUSES ? null : (value as StockStatus))}
          options={STATUS_OPTIONS}
        />
      </div>
      <div className="w-60">
        <Select
          label="Orden"
          value={sort}
          onChange={(value) => onSortChange(value as InventorySort)}
          options={SORT_OPTIONS}
        />
      </div>
    </div>
  );
}

export { InventoryFilters };
