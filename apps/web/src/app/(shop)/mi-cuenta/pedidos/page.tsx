import type { PaginationMeta, PublicOrder } from "@esencia-glow/shared";
import { LoadFailure } from "@/components/storefront/account/shared/load-failure";
import { SectionTitle } from "@/components/storefront/account/shared/section-title";
import { OrdersSection } from "@/components/storefront/account/sections/orders-section";
import { ORDERS_PAGE_SIZE } from "@/components/storefront/account/sections/orders-page-size";
import { fetchAccountData } from "@/lib/storefront/account-server";

export default async function OrdersPage() {
  const orders = await fetchAccountData<PublicOrder[], PaginationMeta>("/api/v1/orders", { page: 1, limit: ORDERS_PAGE_SIZE });
  return (
    <>
      <SectionTitle>Mis pedidos</SectionTitle>
      {orders.status === "ok" ? (
        <OrdersSection initialOrders={orders.data} initialMeta={orders.meta ?? { total: orders.data.length, page: 1, limit: ORDERS_PAGE_SIZE, pages: 1 }} />
      ) : (
        <LoadFailure status={orders.status} what="tus pedidos" />
      )}
    </>
  );
}
