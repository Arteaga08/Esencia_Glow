"use client";

import Link from "next/link";
import { Gift } from "@phosphor-icons/react";
import { useState } from "react";
import { SUBSCRIPTION_SHIPMENT_STATUS_LABELS, SubscriptionStatus, type MySubscription, type SubscriptionShipmentStatus } from "@esencia-glow/shared";
import { Badge, type BadgeColorValue } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoneyMXN } from "@/lib/format-money";
import { accountRequest } from "@/lib/storefront/account-api";
import { classifyError } from "@/lib/storefront/auth-errors";
import { formatCompactDate, formatLongDate } from "../shared/dates";
import { Block, DataList, Notice } from "../shared/frame";
import { CTA_DISABLED, CTA_PRIMARY, CTA_SECONDARY, ROW_ACTION } from "../shared/styles";

type Action = "pause" | "resume" | "cancel" | "undo-cancel";

const INTERVAL_LABEL: Record<MySubscription["billingInterval"], string> = {
  month: "cada mes",
  quarter: "cada 3 meses",
  year: "cada año",
};

const SUCCESS_NOTICE: Record<Action, string> = {
  pause: "Pausamos tu suscripción. No se cobra ni se envía hasta que la reanudes.",
  resume: "Reanudamos tu suscripción.",
  cancel: "Cancelamos tu suscripción.",
  "undo-cancel": "Listo, tu suscripción sigue activa.",
};

interface Badging {
  label: string;
  color: BadgeColorValue;
}

function badgeOf(subscription: MySubscription): Badging {
  if (subscription.cancelAtPeriodEnd && subscription.status !== SubscriptionStatus.CANCELED) return { label: "Se cancela", color: "warning" };
  switch (subscription.status) {
    case SubscriptionStatus.ACTIVE:
      return { label: "Activa", color: "success" };
    case SubscriptionStatus.PAUSED:
      return { label: "Pausada", color: "neutral" };
    case SubscriptionStatus.PAST_DUE:
      return { label: "Pago pendiente", color: "danger" };
    case SubscriptionStatus.INCOMPLETE:
      return { label: "Por confirmar", color: "warning" };
    default:
      return { label: "Cancelada", color: "neutral" };
  }
}

/** Lo que de verdad va a pasar con la próxima caja, según el estado. */
function nextRows(subscription: MySubscription): Array<{ label: string; value: string }> {
  const next = subscription.nextChargeAt;
  if (subscription.status === SubscriptionStatus.PAUSED) return [{ label: "Estado", value: "No se cobra ni se envía mientras esté en pausa." }];
  if (subscription.status === SubscriptionStatus.CANCELED) return [{ label: "Estado", value: "Tu suscripción terminó." }];
  if (subscription.cancelAtPeriodEnd) {
    return [
      ...(next ? [{ label: "Tu plan termina", value: formatLongDate(next) }] : []),
      { label: "Próxima caja", value: "Ya no habrá más cobros después de esta fecha." },
    ];
  }
  if (subscription.status === SubscriptionStatus.PAST_DUE) return [{ label: "Cobro pendiente", value: formatMoneyMXN(subscription.plan.priceCents) }];
  if (subscription.status === SubscriptionStatus.INCOMPLETE) return [{ label: "Estado", value: "Estamos confirmando tu primer pago." }];
  return next ? [{ label: "Próximo cobro", value: `${formatLongDate(next)}, ${formatMoneyMXN(subscription.plan.priceCents)}` }] : [];
}

function cycleLabel(year: number, month: number): string {
  const label = new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Mi suscripción: plan, próximo cobro, envíos y las acciones de autoservicio que ya existen en el API. */
function SubscriptionSection({ initial }: { initial: MySubscription | null }) {
  const [subscription, setSubscription] = useState(initial);
  const [busy, setBusy] = useState<Action | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function run(action: Action) {
    setBusy(action);
    setNotice(null);
    setCancelError(null);
    try {
      const result = await accountRequest<{ subscription: MySubscription | null }>(`/api/v1/subscriptions/me/${action}`, { method: "POST", body: action === "cancel" ? {} : undefined });
      setSubscription(result.data.subscription);
      setConfirmCancel(false);
      setNotice({ tone: "success", text: SUCCESS_NOTICE[action] });
    } catch (caught) {
      const failure = classifyError(caught);
      if (action === "cancel") setCancelError(failure.message);
      else setNotice({ tone: "danger", text: failure.message });
    } finally {
      setBusy(null);
    }
  }

  if (!subscription) {
    return (
      <EmptyState
        icon={Gift}
        title="Aún no tienes una caja"
        description="Cada mes elegimos una caja de skincare para ti y te la enviamos a casa."
        action={
          <Link href="/" className={CTA_SECONDARY}>
            Conocer la suscripción
          </Link>
        }
      />
    );
  }

  const badge = badgeOf(subscription);
  const isPaused = subscription.status === SubscriptionStatus.PAUSED;
  const isActive = subscription.status === SubscriptionStatus.ACTIVE;
  const isEnded = subscription.status === SubscriptionStatus.CANCELED;
  const scheduledCancel = subscription.cancelAtPeriodEnd && !isEnded;
  const canCancel = !isEnded && !scheduledCancel && subscription.status !== SubscriptionStatus.INCOMPLETE;
  const locked = busy !== null || subscription.planChangePending;

  return (
    <div className="flex flex-col gap-6">
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      {subscription.status === SubscriptionStatus.PAST_DUE ? (
        <Notice tone="danger">No pudimos cobrar tu último pago. Lo reintentamos automáticamente; si sigue sin pasar, escríbenos para ayudarte.</Notice>
      ) : null}
      {subscription.planChangePending ? <Notice tone="warning">Estamos aplicando un cambio en tu plan. Vuelve a revisar en unos segundos.</Notice> : null}

      <Block title="Tu plan" action={<Badge color={badge.color}>{badge.label}</Badge>}>
        <p className="text-subtitle text-foreground">{subscription.plan.name}</p>
        <p className="mb-5 text-body-sm text-muted-foreground-strong">
          {formatMoneyMXN(subscription.plan.priceCents)} {INTERVAL_LABEL[subscription.billingInterval]}
        </p>
        <DataList rows={nextRows(subscription)} />
        <div className="-mx-1 mt-6 flex flex-wrap items-center gap-x-4 gap-y-1">
          {isPaused ? (
            busy === "resume" ? (
              <span className={`${CTA_DISABLED} mx-1`}>Reanudando…</span>
            ) : (
              <button type="button" disabled={locked} onClick={() => run("resume")} className={`${CTA_PRIMARY} mx-1`}>
                Reanudar mi caja
              </button>
            )
          ) : null}
          {scheduledCancel && subscription.canUndoCancel ? (
            busy === "undo-cancel" ? (
              <span className={`${CTA_DISABLED} mx-1`}>Un momento…</span>
            ) : (
              <button type="button" disabled={locked} onClick={() => run("undo-cancel")} className={`${CTA_PRIMARY} mx-1`}>
                Mantener mi suscripción
              </button>
            )
          ) : null}
          {isActive && !scheduledCancel ? (
            <button type="button" disabled={locked} onClick={() => run("pause")} className={ROW_ACTION}>
              {busy === "pause" ? "Pausando…" : "Pausar"}
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                setCancelError(null);
                setConfirmCancel(true);
              }}
              className={ROW_ACTION}
            >
              Cancelar suscripción
            </button>
          ) : null}
        </div>
      </Block>

      {subscription.shipments.length > 0 ? (
        <Block title="Tus cajas">
          <ul className="flex flex-col">
            {subscription.shipments.map((shipment) => (
              <li key={shipment.id} className="flex items-center justify-between gap-4 border-t border-border py-3 first:border-t-0 first:pt-0">
                <div className="min-w-0">
                  <p className="text-body text-foreground">{cycleLabel(shipment.cycleYear, shipment.cycleMonth)}</p>
                  {shipment.trackingNumber ? <p className="font-mono text-data text-muted-foreground-strong">Guía {shipment.trackingNumber}</p> : null}
                </div>
                <div className="flex items-center gap-3">
                  {shipment.shippedAt ? <p className="hidden text-body-sm text-muted-foreground-strong sm:block">{formatCompactDate(shipment.shippedAt)}</p> : null}
                  <Badge color={shipment.status === "delivered" ? "success" : shipment.status === "shipped" ? "primary" : "neutral"}>
                    {SUBSCRIPTION_SHIPMENT_STATUS_LABELS[shipment.status as SubscriptionShipmentStatus] ?? shipment.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      <ConfirmModal
        open={confirmCancel}
        title="Cancelar suscripción"
        confirmLabel="Cancelar suscripción"
        cancelLabel="Conservarla"
        variant="destructive"
        loading={busy === "cancel"}
        error={cancelError}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => run("cancel")}
      >
        <p className="text-body text-foreground/80">
          {subscription.nextChargeAt
            ? `Seguirás recibiendo tu caja hasta el ${formatLongDate(subscription.nextChargeAt)} y después ya no te cobraremos. `
            : "Ya no te cobraremos. "}
          Mientras dure tu período pagado puedes cambiar de opinión.
        </p>
      </ConfirmModal>
    </div>
  );
}

export { SubscriptionSection };
