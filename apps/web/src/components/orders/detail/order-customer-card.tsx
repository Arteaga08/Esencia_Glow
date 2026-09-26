import type { AdminOrder } from "@esencia-glow/shared";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format-date";
import { DetailField } from "./detail-field";

/** Si `customer` es `null` (cuenta borrada), se cae al contacto congelado
 * en `shippingAddress` — mismo criterio que usa el listado (`order-row.tsx`). */
function OrderCustomerCard({ order }: { order: AdminOrder }) {
  const customerName = order.customer
    ? `${order.customer.firstName} ${order.customer.lastName}`
    : order.shippingAddress.fullName;

  return (
    <Card>
      <p className="mb-4 font-mono text-label uppercase tracking-[0.06em] text-muted-foreground-strong">Cliente</p>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DetailField label="Nombre">{customerName}</DetailField>
        {order.customer ? <DetailField label="Correo">{order.customer.email}</DetailField> : null}
        <DetailField label="Términos aceptados">{formatDateTime(order.termsAcceptedAt)}</DetailField>
      </dl>
    </Card>
  );
}

export { OrderCustomerCard };
