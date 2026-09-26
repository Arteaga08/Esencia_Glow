"use client";

import { useEffect, useState } from "react";
import { ORDER_PRIORITY_LABELS, OrderPriority, type OrderStatusGroup } from "@esencia-glow/shared";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { OrderQueueSection } from "@/components/orders/order-queue-section";
import type { OrderGroupFilters } from "@/components/orders/use-order-group";

const SEARCH_DEBOUNCE_MS = 300;

const GROUPS: OrderStatusGroup[] = ["action", "progress", "shipping", "problems"];

const PRIORITY_OPTIONS = [
  { value: OrderPriority.HIGH, label: ORDER_PRIORITY_LABELS[OrderPriority.HIGH] },
  { value: OrderPriority.URGENT, label: ORDER_PRIORITY_LABELS[OrderPriority.URGENT] },
];

/**
 * Milestone 2.3 — Pedidos: compras de tienda (producto y paquetes). Las
 * cajas de suscripción son otro modelo (`SubscriptionShipment`) y viven en
 * "Suscripciones ▸ Ediciones", no aquí. Propuesta B elegida por Manuel:
 * cuatro colas de trabajo apiladas y colapsables en vez de una tabla única
 * con tarjetas KPI (DESIGN.md rechaza esa plantilla) — cada cola es su
 * propia página del listado admin, ver `use-order-group.ts`.
 */
export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [priority, setPriority] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [debouncedOrderNumber, setDebouncedOrderNumber] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedOrderNumber(orderNumber), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [orderNumber]);

  const filters: OrderGroupFilters = {
    search: debouncedSearch,
    priority,
    orderNumber: debouncedOrderNumber,
  };
  const isFiltered = Boolean(debouncedSearch || priority || debouncedOrderNumber);

  return (
    <div>
      <p className="mb-6 text-body text-muted-foreground-strong">
        Compras de tienda (producto y paquetes). Las cajas de suscripción viven en Suscripciones ▸ Ediciones.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="w-72">
          <Input
            label="Buscar"
            placeholder="Busca por nombre, correo o teléfono"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="w-48">
          <Select
            label="Prioridad"
            value={priority}
            onChange={(value) => setPriority(value || null)}
            options={PRIORITY_OPTIONS}
            placeholder="Todas"
          />
        </div>
        <div className="w-56">
          <Input
            label="Número de pedido"
            placeholder="EG-2026-K7XQ2M"
            value={orderNumber}
            onChange={(event) => setOrderNumber(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {GROUPS.map((group) => (
          <OrderQueueSection key={group} group={group} filters={filters} isFiltered={isFiltered} />
        ))}
      </div>
    </div>
  );
}
