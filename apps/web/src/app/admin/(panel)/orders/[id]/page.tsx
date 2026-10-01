"use client";

import { useParams } from "next/navigation";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrderCapabilities } from "@/components/orders/detail/order-capabilities";
import { OrderAlerts } from "@/components/orders/detail/order-alerts";
import { OrderCustomerCard } from "@/components/orders/detail/order-customer-card";
import { OrderDetailHeader } from "@/components/orders/detail/order-detail-header";
import { OrderHistoryCard } from "@/components/orders/detail/order-history-card";
import { OrderLinesCard } from "@/components/orders/detail/order-lines-card";
import { OrderNotesCard } from "@/components/orders/detail/order-notes-card";
import { OrderPaymentCard } from "@/components/orders/detail/order-payment-card";
import { OrderShippingCard } from "@/components/orders/detail/order-shipping-card";
import { OrderStatusBlock } from "@/components/orders/detail/order-status-block";
import { useAdminOrder } from "@/components/orders/detail/use-admin-order";
import { useOrderHistory } from "@/components/orders/detail/use-order-history";

/**
 * Detalle de pedido (Milestone 2.3b): siete acciones que el backend ya
 * expone (estatus, prioridad, corregir dirección, corregir guía, nota
 * interna, reembolso con 2FA, reintento de guía) más notas legibles (`GET
 * /:id/notes`, endpoint nuevo de esta sesión). El `<h1>` lo pone `TopBar`
 * ("Pedidos") derivado de la ruta — esta página no lo repite.
 *
 * Una sola columna, bloques por categoría (mismo patrón que
 * `products/[id]` y `bundles/[id]`): editar las líneas del pedido queda
 * fuera de alcance (no hay backend, y toca dinero ya capturado).
 */
export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { order, setOrder, loadError, refresh } = useAdminOrder(params.id);
  const history = useOrderHistory(params.id);

  if (loadError) {
    return <ErrorState description={loadError} />;
  }

  if (!order) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const capabilities = getOrderCapabilities(order);

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <OrderDetailHeader order={order} />
      <OrderAlerts order={order} />
      <OrderStatusBlock
        order={order}
        capabilities={capabilities}
        onOrderUpdated={setOrder}
        onOrderChanged={history.refreshAll}
        refreshOrder={refresh}
      />
      <OrderLinesCard lines={order.lines} totals={order.totals} />
      <OrderPaymentCard
        order={order}
        capabilities={capabilities}
        onOrderUpdated={setOrder}
        onOrderChanged={history.refreshAll}
        refreshOrder={refresh}
      />
      <OrderShippingCard
        order={order}
        capabilities={capabilities}
        onOrderUpdated={setOrder}
        onOrderChanged={history.refreshAll}
        refreshOrder={refresh}
      />
      <OrderCustomerCard order={order} />
      <OrderNotesCard orderId={order.id} onOrderUpdated={setOrder} onOrderChanged={history.refreshAll} />
      <OrderHistoryCard
        order={order}
        activity={history.activity}
        activityError={history.activityError}
        tracking={history.tracking}
        trackingError={history.trackingError}
        onOpenTracking={history.ensureTrackingLoaded}
      />
    </div>
  );
}
