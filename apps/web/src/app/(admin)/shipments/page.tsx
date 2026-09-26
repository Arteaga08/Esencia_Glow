"use client";

import { useState } from "react";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { StoreShipmentsTab } from "./store-shipments-tab";
import { SubscriptionShipmentsTab } from "./subscription-shipments-tab";

const CHANNEL_TABS: TabItem[] = [
  { id: "store", label: "Tienda" },
  { id: "subscription", label: "Suscripción" },
];

/**
 * Milestone 2.4 — Envíos. Tienda (`Order`) y suscripción
 * (`SubscriptionShipment`) no comparten modelo ni endpoint (ver el plan del
 * milestone), así que la pantalla los separa por pestaña en vez de forzar
 * un listado único. Propuesta A elegida por Manuel: misma lógica visual de
 * Pedidos (2.3), colas de trabajo apiladas y colapsables. Sin
 * `/shipments/[id]`: el detalle profundo del pedido ya vive en
 * `/orders/[id]`.
 */
export default function ShipmentsPage() {
  const [channel, setChannel] = useState("store");

  return (
    <div>
      <p className="mb-6 text-body text-muted-foreground-strong">
        Guías de tienda y cajas de suscripción. El detalle completo de cada pedido sigue en Pedidos.
      </p>
      <div className="mb-6">
        <Tabs items={CHANNEL_TABS} activeId={channel} onChange={setChannel} ariaLabel="Canal de envío" />
      </div>
      {channel === "store" ? <StoreShipmentsTab /> : <SubscriptionShipmentsTab />}
    </div>
  );
}
