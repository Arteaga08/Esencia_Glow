"use client";

import { useState } from "react";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { ReservationsTab } from "./reservations-tab";
import { StockTab } from "./stock-tab";

const INVENTORY_TABS: TabItem[] = [
  { id: "stock", label: "Existencias" },
  { id: "reservations", label: "Apartados" },
];

/**
 * Milestone 2.5 — Inventario. Propuesta A elegida por Manuel (colas por
 * categoría raíz, abiertas solo si hay algo que surtir) más la miniatura del
 * producto en cada fila. Apartados va en su propia pestaña, mismo patrón que
 * Tienda/Suscripción en Envíos: una reserva cruza productos, así que no se
 * agrupa por categoría.
 */
export default function InventoryPage() {
  const [tab, setTab] = useState("stock");

  return (
    <div>
      <div className="mb-6">
        <Tabs items={INVENTORY_TABS} activeId={tab} onChange={setTab} ariaLabel="Vista de inventario" />
      </div>
      {tab === "stock" ? <StockTab /> : <ReservationsTab />}
    </div>
  );
}
