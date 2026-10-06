import { notFound } from "next/navigation";
import type { PublicOrder, PublicOrderTracking } from "@esencia-glow/shared";
import { LoadError } from "@/components/storefront/account/shared/load-error";
import { OrderDetail } from "@/components/storefront/account/sections/order-detail";
import { fetchAccountData } from "@/lib/storefront/account-server";

/** Detalle de un pedido propio. Uno ajeno o inexistente es 404 (el API ya lo filtra por dueña). */
export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, tracking] = await Promise.all([
    fetchAccountData<PublicOrder>(`/api/v1/orders/${encodeURIComponent(id)}`),
    fetchAccountData<PublicOrderTracking>(`/api/v1/orders/${encodeURIComponent(id)}/tracking`),
  ]);

  if (order.status === "notFound") notFound();
  if (order.status === "error") return <LoadError what="tu pedido" />;

  return <OrderDetail order={order.data} tracking={tracking.status === "ok" ? tracking.data : null} />;
}
