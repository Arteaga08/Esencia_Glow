import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatMoneyMXN } from "@/lib/format-money";
import { formatCompactDate, formatLongDate } from "../_kit/dates";
import type { AccountData } from "../_kit/fixture";
import { ORDER_STATUS } from "../_kit/orders-section";
import { previewHref } from "../_kit/preview-state";
import { LABEL, ROW_ACTION } from "../_kit/styles";
import type { AccountView } from "../_kit/types";

interface HomeBProps {
  base: string;
  data: AccountData;
  hasSubscription: boolean;
}

interface SummaryRowProps {
  label: string;
  action: { href: string; text: string };
  children: ReactNode;
}

function SummaryRow({ label, action, children }: SummaryRowProps) {
  return (
    <div className="grid items-start gap-x-6 gap-y-1 border-b border-border-strong py-5 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
      <dt className={`${LABEL} pt-1`}>{label}</dt>
      <dd className="min-w-0">{children}</dd>
      <Link href={action.href} className={`${ROW_ACTION} -ml-1 sm:ml-0`}>
        {action.text}
      </Link>
    </div>
  );
}

/** Resumen de apertura de B: cuatro renglones (caja, pedido, dirección, cuenta), cada uno con su acción. */
function HomeB({ base, data, hasSubscription }: HomeBProps) {
  const lastOrder = data.orders[0]!;
  const status = ORDER_STATUS[lastOrder.status];
  const address = data.addresses[0]!;
  const to = (view: AccountView, state?: string) => previewHref(base, view, state);

  return (
    <dl className="border-t border-border-strong">
      <SummaryRow label="Próxima caja" action={{ href: to("suscripcion"), text: hasSubscription ? "Administrar" : "Conocer" }}>
        {hasSubscription ? (
          <>
            <p className="text-subtitle text-foreground">{formatLongDate(data.subscription.nextBoxShipsAt)}</p>
            <p className="text-body-sm text-muted-foreground-strong">
              {data.subscription.planName}, {formatMoneyMXN(data.subscription.priceCents)} {data.subscription.intervalLabel}. Se cobra el {formatCompactDate(data.subscription.nextChargeAt)}.
            </p>
          </>
        ) : (
          <p className="text-body text-foreground/80">Aún no tienes una caja. Cada mes elegimos una de skincare para ti.</p>
        )}
      </SummaryRow>

      <SummaryRow label="Último pedido" action={{ href: to("pedidos", lastOrder.oxxo ? "oxxo" : "detalle"), text: "Ver pedido" }}>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-data text-foreground">{lastOrder.number}</span>
          <Badge color={status.color}>{status.label}</Badge>
        </p>
        <p className="mt-1 text-body-sm text-muted-foreground-strong">
          {formatCompactDate(lastOrder.createdAt)}, {formatMoneyMXN(lastOrder.totalCents)}
        </p>
      </SummaryRow>

      <SummaryRow label="Dirección principal" action={{ href: to("direcciones"), text: "Cambiar" }}>
        <p className="text-body text-foreground">
          {address.street} {address.exteriorNumber}, {address.interiorNumber}
        </p>
        <p className="text-body-sm text-muted-foreground-strong">
          {address.neighborhood}, {address.city}, {address.state}
        </p>
      </SummaryRow>

      <SummaryRow label="Cuenta" action={{ href: to("perfil"), text: "Editar" }}>
        <p className="text-body text-foreground">{data.user.email}</p>
        <p className="text-body-sm text-muted-foreground-strong">Contraseña actualizada el {formatCompactDate(data.user.passwordChangedAt)}</p>
      </SummaryRow>
    </dl>
  );
}

export { HomeB };
