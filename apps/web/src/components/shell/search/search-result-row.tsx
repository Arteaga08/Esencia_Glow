import Image from "next/image";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { formatMoneyMXN } from "@/lib/format-money";
import type { SearchItem } from "./search-items";

function RowText({ title, detail }: { title: string; detail: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-body text-foreground">{title}</span>
      <span className="truncate text-body-sm text-muted-foreground-strong">{detail}</span>
    </span>
  );
}

/** Contenido de un renglón del buscador; el enlace y el resaltado los pone quien lo monta. */
function SearchResultRow({ item }: { item: SearchItem }) {
  if (item.kind === "order") {
    const { order } = item;
    const buyer = order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : order.shippingAddress.fullName;
    return (
      <>
        <RowText title={order.orderNumber} detail={`${buyer} · ${formatMoneyMXN(order.totals.totalCents)}`} />
        <OrderStatusBadge status={order.status} />
      </>
    );
  }

  if (item.kind === "customer") {
    const { customer } = item;
    return <RowText title={`${customer.firstName} ${customer.lastName}`} detail={customer.email} />;
  }

  const { product } = item;
  const image = product.images[0];
  return (
    <>
      <span className="relative size-9 shrink-0 overflow-hidden rounded-sm bg-muted">
        {image ? <Image src={image.url} alt="" fill sizes="36px" className="object-cover" /> : null}
      </span>
      <RowText title={product.name} detail={product.variants[0]?.sku ?? "Sin variantes"} />
    </>
  );
}

export { SearchResultRow };
