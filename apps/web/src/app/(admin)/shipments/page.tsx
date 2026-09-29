"use client";

import { useEffect, useRef, useState } from "react";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { useInitialQueryParam } from "@/lib/hooks/use-initial-query-param";
import { StoreShipmentsTab } from "./store-shipments-tab";
import { SubscriptionShipmentsTab } from "./subscription-shipments-tab";

const CHANNEL_TABS: TabItem[] = [
  { id: "store", label: "Tienda" },
  { id: "subscription", label: "Suscripción" },
];

const VALID_CHANNELS = new Set(["store", "subscription"]);

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
  const initialChannel = useInitialQueryParam("channel");
  const initialQueue = useInitialQueryParam("queue");
  const [channel, setChannel] = useState(() =>
    initialChannel && VALID_CHANNELS.has(initialChannel) ? initialChannel : "store",
  );

  // Llegada desde la tarjeta de Envíos del Resumen (Milestone 2.9): las
  // colas ya están abiertas por default (mismo criterio que Pedidos), así
  // que enfocar es desplazar hasta la cola pedida en el canal ya elegido.
  // SOLO al montar: `channelRef` deja leer el canal actual sin que el
  // efecto reviva cada vez que la clienta cambia de pestaña a mano — sin
  // esto, `delivered` (la única cola que existe en ambos canales) volvía a
  // hacer scroll cada vez que se cambiaba de Tienda a Suscripción o
  // viceversa (hallazgo de code review).
  const channelRef = useRef(channel);
  useEffect(() => {
    channelRef.current = channel;
  }, [channel]);
  useEffect(() => {
    if (!initialQueue) return;
    document
      .getElementById(`shipment-queue-${channelRef.current}-${initialQueue}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialQueue]);

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
