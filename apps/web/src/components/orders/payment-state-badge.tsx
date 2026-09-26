import { PaymentState } from "@esencia-glow/shared";
import { Badge, type BadgeColorValue } from "@/components/ui/badge";

const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  [PaymentState.PENDING]: "Pendiente",
  [PaymentState.CAPTURED]: "Cobrado",
  [PaymentState.FAILED]: "Fallido",
  [PaymentState.CANCELED]: "Cancelado",
  [PaymentState.REFUNDED]: "Reembolsado",
};

const PAYMENT_STATE_COLOR: Record<PaymentState, BadgeColorValue> = {
  [PaymentState.PENDING]: "warning",
  [PaymentState.CAPTURED]: "success",
  [PaymentState.FAILED]: "danger",
  [PaymentState.CANCELED]: "danger",
  [PaymentState.REFUNDED]: "neutral",
};

function PaymentStateBadge({ state }: { state: PaymentState }) {
  return <Badge color={PAYMENT_STATE_COLOR[state]}>{PAYMENT_STATE_LABELS[state]}</Badge>;
}

export { PaymentStateBadge, PAYMENT_STATE_LABELS };
