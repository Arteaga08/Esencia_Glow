"use client";

import Link from "next/link";
import { Package } from "@phosphor-icons/react";
import { useState } from "react";
import { ORDER_STATUS_LABELS, type PaginationMeta, type PublicOrder } from "@esencia-glow/shared";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { formatMoneyMXN } from "@/lib/format-money";
import { accountRequest } from "@/lib/storefront/account-api";
import { formatCompactDate } from "../shared/dates";
import { Item, ItemList, Thumb } from "../shared/frame";
import { CTA_SECONDARY, TEXT_LINK } from "../shared/styles";
import { ORDER_STATUS_COLOR } from "./order-status";
import { ORDERS_PAGE_SIZE } from "./orders-page-size";

function summarize(order: PublicOrder): string {
  const [first, ...rest] = order.lines;
  if (!first) return "";
  return rest.length === 0 ? first.name : `${first.name} y ${rest.length} más`;
}

function OrderRow({ order }: { order: PublicOrder }) {
  const pendingOxxo = order.status === "pending" && order.payment.voucherExpiresAt;

  return (
    <Item className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex shrink-0 -space-x-3">
        {order.lines.slice(0, 3).map((line) => (
          <Thumb key={`${line.itemId}-${line.sku}`} name={line.name} image={line.image} className="h-[70px] w-14 ring-2 ring-surface" sizes="56px" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="font-mono text-data text-foreground">{order.orderNumber}</p>
          <Badge color={ORDER_STATUS_COLOR[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
        </div>
        <p className="mt-1 truncate text-body text-foreground">{summarize(order)}</p>
        <p className="text-body-sm text-muted-foreground-strong">
          {formatCompactDate(order.createdAt)}
          {pendingOxxo ? `. Paga en OXXO antes del ${formatCompactDate(order.payment.voucherExpiresAt!)}` : ""}
        </p>
      </div>
      <div className="flex items-center justify-between gap-6 sm:flex-col sm:items-end sm:gap-1">
        <p className="font-mono text-data text-foreground">{formatMoneyMXN(order.totals.totalCents)}</p>
        <Link href={`/mi-cuenta/pedidos/${order.id}`} className={TEXT_LINK}>
          Ver detalle
        </Link>
      </div>
    </Item>
  );
}

interface OrdersSectionProps {
  initialOrders: PublicOrder[];
  initialMeta: PaginationMeta;
}

/** Historial de pedidos: lista paginada o estado vacío. */
function OrdersSection({ initialOrders, initialMeta }: OrdersSectionProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function goToPage(page: number) {
    setLoading(true);
    setFailed(false);
    try {
      const result = await accountRequest<PublicOrder[], PaginationMeta>("/api/v1/orders", { query: { page, limit: ORDERS_PAGE_SIZE } });
      setOrders(result.data);
      if (result.meta) setMeta(result.meta);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  if (orders.length === 0 && meta.total === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Todavía no has comprado"
        description="Cuando hagas tu primer pedido lo verás aquí, con su seguimiento."
        action={
          <Link href="/" className={CTA_SECONDARY}>
            Ir a la tienda
          </Link>
        }
      />
    );
  }

  if (failed) return <ErrorState description="No pudimos traer tus pedidos. Inténtalo de nuevo." onRetry={() => goToPage(meta.page)} />;

  return (
    <div aria-busy={loading} className={loading ? "opacity-60 transition-opacity" : undefined}>
      <ItemList>
        {orders.map((order) => (
          <OrderRow key={order.id} order={order} />
        ))}
      </ItemList>
      <Pagination meta={meta} onPageChange={goToPage} itemLabel={{ singular: "pedido", plural: "pedidos" }} />
    </div>
  );
}

export { OrdersSection };
