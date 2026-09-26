"use client";

import { useState } from "react";
import type { AdminOrder, AdminOrderTracking } from "@esencia-glow/shared";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { OrderActivityTab } from "./order-activity-tab";
import { OrderTrackingTab } from "./order-tracking-tab";
import type { OrderActivityEntry } from "./merge-order-timeline";

interface OrderHistoryCardProps {
  order: AdminOrder;
  activity: OrderActivityEntry[] | null;
  activityError: string | null;
  tracking: AdminOrderTracking | null;
  trackingError: string | null;
  onOpenTracking: () => void;
}

const TABS = [
  { id: "activity", label: "Bitácora" },
  { id: "tracking", label: "Rastreo" },
];

/** `Tabs` (DESIGN.md §5, primitivo nuevo de este milestone): Bitácora fusiona
 * `statusHistory` + `/activity`; Rastreo pide `/tracking` de forma perezosa
 * la primera vez que se abre esta pestaña. */
function OrderHistoryCard({ order, activity, activityError, tracking, trackingError, onOpenTracking }: OrderHistoryCardProps) {
  const [activeTab, setActiveTab] = useState<string>("activity");

  function handleChange(id: string) {
    setActiveTab(id);
    if (id === "tracking") onOpenTracking();
  }

  return (
    <Card>
      <p className="mb-4 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">Historial</p>
      <Tabs items={TABS} activeId={activeTab} onChange={handleChange} ariaLabel="Historial del pedido" />
      <div id={`tabpanel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} className="mt-4">
        {activeTab === "activity" ? (
          <OrderActivityTab statusHistory={order.statusHistory} activity={activity} activityError={activityError} />
        ) : (
          <OrderTrackingTab tracking={tracking} trackingError={trackingError} />
        )}
      </div>
    </Card>
  );
}

export { OrderHistoryCard };
