import { Warning } from "@phosphor-icons/react";
import { DisputeStatus, PaymentMethod, ShippingLabelStatus, type AdminOrder } from "@esencia-glow/shared";
import { formatDateTime } from "@/lib/format-date";

interface Alert {
  id: string;
  tone: "warning" | "danger";
  message: string;
}

const TONE_CLASSNAMES: Record<Alert["tone"], string> = {
  warning: "border-accent-foreground-strong/40 bg-accent/40 text-accent-foreground-strong",
  danger: "border-destructive-action/40 bg-destructive/20 text-destructive-action",
};

function buildAlerts(order: AdminOrder): Alert[] {
  const alerts: Alert[] = [];

  if (order.inventoryIncident) {
    alerts.push({ id: "inventory", tone: "danger", message: "Este pedido tiene una incidencia de inventario pendiente de revisión." });
  }
  if (order.adminAlertedAt) {
    alerts.push({ id: "payment-anomaly", tone: "danger", message: "Hay una anomalía de pago pendiente de revisión desde " + formatDateTime(order.adminAlertedAt) + "." });
  }
  if (order.disputeStatus === DisputeStatus.OPEN) {
    alerts.push({ id: "dispute", tone: "danger", message: "El pedido tiene un contracargo abierto — algunas acciones están bloqueadas hasta que se resuelva." });
  }
  if (order.label?.status === ShippingLabelStatus.NEEDS_REVIEW) {
    alerts.push({ id: "label-review", tone: "warning", message: "La guía de envío quedó en revisión — confirma en el panel del proveedor antes de reintentar." });
  }
  if (order.label?.status === ShippingLabelStatus.FAILED) {
    alerts.push({ id: "label-failed", tone: "warning", message: "El proveedor rechazó la última compra de guía" + (order.label.lastError ? `: ${order.label.lastError}` : ".") });
  }
  if (order.expiresAt) {
    alerts.push({ id: "expires", tone: "warning", message: "El pedido expira el " + formatDateTime(order.expiresAt) + " si el pago no se confirma." });
  }
  if (order.payment.lastError) {
    alerts.push({ id: "payment-error", tone: "warning", message: `Último error de pago: ${order.payment.lastError}` });
  }
  if (order.payment.method === PaymentMethod.OXXO && order.payment.voucherExpiresAt) {
    alerts.push({ id: "voucher", tone: "warning", message: "La ficha OXXO vence el " + formatDateTime(order.payment.voucherExpiresAt) + "." });
  }

  return alerts;
}

/** Solo se renderiza si hay algo que avisar. Sin acciones propias: cada
 * alerta apunta a un bloque más abajo (Pago, Envío, Estado). */
function OrderAlerts({ order }: { order: AdminOrder }) {
  const alerts = buildAlerts(order);
  if (alerts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-body-sm ${TONE_CLASSNAMES[alert.tone]}`}
        >
          <Warning size={16} weight="regular" className="mt-0.5 shrink-0" aria-hidden="true" />
          {alert.message}
        </div>
      ))}
    </div>
  );
}

export { OrderAlerts };
