import { SUBSCRIPTION_STATUS_LABELS, SubscriptionStatus } from "@esencia-glow/shared";
import { Badge, type BadgeColorValue } from "@/components/ui/badge";

/** Mismo criterio que `OrderStatusBadge` (DESIGN.md §5 Badge): éxito solo
 * para el estado sano (`active`); atención para lo que necesita revisión
 * (`past_due`, `incomplete`); pausada es neutra (decisión reversible de la
 * clienta, no una anomalía); cancelada es negativa. */
const STATUS_COLOR: Record<SubscriptionStatus, BadgeColorValue> = {
  [SubscriptionStatus.INCOMPLETE]: "warning",
  [SubscriptionStatus.ACTIVE]: "success",
  [SubscriptionStatus.PAST_DUE]: "warning",
  [SubscriptionStatus.PAUSED]: "neutral",
  [SubscriptionStatus.CANCELED]: "danger",
};

function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus | null }) {
  if (!status) return <Badge color="neutral">Sin suscripción</Badge>;
  return <Badge color={STATUS_COLOR[status]}>{SUBSCRIPTION_STATUS_LABELS[status]}</Badge>;
}

export { SubscriptionStatusBadge };
