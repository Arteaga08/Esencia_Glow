import Link from "next/link";
import { Gift } from "@phosphor-icons/react/ssr";
import { Badge, type BadgeColorValue } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoneyMXN } from "@/lib/format-money";
import { formatCompactDate, formatLongDate } from "./dates";
import type { DemoSubscription } from "./fixture";
import { Block, DataList, Notice, type Tone } from "./frame";
import { previewHref } from "./preview-state";
import { CTA_PRIMARY, CTA_SECONDARY, ROW_ACTION } from "./styles";

interface SubscriptionSectionProps {
  tone: Tone;
  state: string | null;
  base: string;
  subscription: DemoSubscription;
}

type Kind = "activa" | "pausada" | "cancelacion" | "pagofallido";

const KIND_BADGE: Record<Kind, { label: string; color: BadgeColorValue }> = {
  activa: { label: "Activa", color: "success" },
  pausada: { label: "Pausada", color: "neutral" },
  cancelacion: { label: "Se cancela", color: "warning" },
  pagofallido: { label: "Pago pendiente", color: "danger" },
};

function kindOf(state: string | null): Kind {
  return state === "pausada" || state === "cancelacion" || state === "pagofallido" ? state : "activa";
}

/** Texto de la próxima caja según el estado: lo que de verdad va a pasar. */
function nextLines(kind: Kind, subscription: DemoSubscription): Array<{ label: string; value: string }> {
  switch (kind) {
    case "pausada":
      return [
        { label: "Estado", value: "No se cobra ni se envía mientras esté en pausa." },
        { label: "Última caja", value: formatLongDate(subscription.charges[0]!.at) },
      ];
    case "cancelacion":
      return [
        { label: "Tu plan termina", value: formatLongDate(subscription.nextChargeAt) },
        { label: "Próxima caja", value: "Ya no habrá más cobros después de esta fecha." },
      ];
    case "pagofallido":
      return [
        { label: "Cobro pendiente", value: formatMoneyMXN(subscription.priceCents) },
        { label: "Reintentamos", value: "8 de octubre de 2026" },
      ];
    default:
      return [
        { label: "Próximo cobro", value: `${formatLongDate(subscription.nextChargeAt)}, ${formatMoneyMXN(subscription.priceCents)}` },
        { label: "Tu caja sale", value: formatLongDate(subscription.nextBoxShipsAt) },
      ];
  }
}

/** Mi suscripción: plan, próxima caja, método de pago, historial y las acciones de autoservicio. */
function SubscriptionSection({ tone, state, base, subscription }: SubscriptionSectionProps) {
  const here = (estado?: string) => previewHref(base, "suscripcion", estado);

  if (state === "sin") {
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

  const kind = kindOf(state);
  const badge = KIND_BADGE[kind];

  return (
    <div className="flex flex-col gap-6">
      {kind === "pagofallido" ? (
        <Notice tone="danger">No pudimos cobrar tu {subscription.cardLabel.toLowerCase()}. Actualiza tu tarjeta antes del 8 de octubre para no perder tu caja.</Notice>
      ) : null}
      {kind === "cancelacion" ? <Notice tone="warning">Cancelaste tu suscripción. Sigues recibiendo tu caja hasta el {formatLongDate(subscription.nextChargeAt)}.</Notice> : null}

      <Block tone={tone} title="Tu plan" action={<Badge color={badge.color}>{badge.label}</Badge>}>
        <p className="text-subtitle text-foreground">{subscription.planName}</p>
        <p className="mb-5 text-body-sm text-muted-foreground-strong">
          {formatMoneyMXN(subscription.priceCents)} {subscription.intervalLabel}
        </p>
        <DataList rows={nextLines(kind, subscription).map((line) => ({ label: line.label, value: line.value }))} />
        <div className="-mx-1 mt-6 flex flex-wrap items-center gap-x-4 gap-y-1">
          {kind === "pausada" ? (
            <Link href={here()} className={`${CTA_PRIMARY} mx-1`}>
              Reanudar mi caja
            </Link>
          ) : null}
          {kind === "cancelacion" ? (
            <Link href={here()} className={`${CTA_PRIMARY} mx-1`}>
              Mantener mi suscripción
            </Link>
          ) : null}
          {kind === "activa" ? (
            <Link href={here("pausada")} className={ROW_ACTION}>
              Pausar
            </Link>
          ) : null}
          {kind === "activa" || kind === "pagofallido" ? (
            <Link href={here("cancelacion")} className={ROW_ACTION}>
              Cancelar suscripción
            </Link>
          ) : null}
          {kind === "pagofallido" ? (
            <Link href={here()} className={ROW_ACTION}>
              Ya actualicé mi tarjeta
            </Link>
          ) : null}
        </div>
      </Block>

      <Block
        tone={tone}
        title="Método de pago"
        action={
          <button type="button" className={ROW_ACTION}>
            {kind === "pagofallido" ? "Actualizar tarjeta" : "Cambiar tarjeta"}
          </button>
        }
      >
        <p className={`text-body ${kind === "pagofallido" ? "text-destructive-action" : "text-foreground"}`}>{subscription.cardLabel}</p>
        {kind === "pagofallido" ? <p className="text-body-sm text-destructive-action">El último cobro fue rechazado por el banco.</p> : null}
      </Block>

      <Block tone={tone} title="Cobros">
        <ul className="flex flex-col">
          {subscription.charges.map((charge, index) => (
            <li key={charge.id} className="flex items-center justify-between gap-4 border-t border-border py-3 first:border-t-0 first:pt-0">
              <p className="text-body text-foreground">{formatCompactDate(charge.at)}</p>
              <div className="flex items-center gap-4">
                <p className="font-mono text-data text-foreground">{formatMoneyMXN(charge.amountCents)}</p>
                <Badge color={kind === "pagofallido" && index === 0 ? "danger" : "success"}>{kind === "pagofallido" && index === 0 ? "Rechazado" : "Pagado"}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </Block>
    </div>
  );
}

export { SubscriptionSection };
