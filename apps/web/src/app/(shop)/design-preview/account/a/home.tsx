import Link from "next/link";
import { SignOut } from "@phosphor-icons/react/ssr";
import { Badge } from "@/components/ui/badge";
import { formatMoneyMXN } from "@/lib/format-money";
import { formatCompactDate, formatLongDate } from "../_kit/dates";
import type { AccountData } from "../_kit/fixture";
import { Thumb } from "../_kit/frame";
import { ACCOUNT_NAV, greetingName, sectionSummary } from "../_kit/nav";
import { ORDER_STATUS } from "../_kit/orders-section";
import { previewHref } from "../_kit/preview-state";
import { CTA_SECONDARY, FOCUS, LABEL, TEXT_LINK } from "../_kit/styles";

interface HomeAProps {
  base: string;
  data: AccountData;
  hasSubscription: boolean;
}

const CARD = "flex flex-col rounded-md border border-border-strong bg-surface p-6";

/**
 * Inicio de Mi cuenta en A: lo que importa hoy (la próxima caja y el último
 * pedido) y, solo en móvil, la rejilla de accesos a cada sección. En
 * escritorio la barra lateral ya cumple ese papel.
 */
function HomeA({ base, data, hasSubscription }: HomeAProps) {
  const lastOrder = data.orders[0]!;
  const status = ORDER_STATUS[lastOrder.status];

  return (
    <div>
      <h1 className="text-page-title text-foreground md:text-display">Hola, {greetingName(data)}</h1>
      <p className="mt-2 max-w-[52ch] text-body text-foreground/80">Esto es lo que pasa con tu cuenta hoy.</p>

      <div className="mt-8 grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <section aria-labelledby="next-box" className={CARD}>
          <h2 id="next-box" className={LABEL}>
            Tu próxima caja
          </h2>
          {hasSubscription ? (
            <>
              <p className="mt-4 text-display text-foreground">{formatLongDate(data.subscription.nextBoxShipsAt).replace(" de 2026", "")}</p>
              <p className="mt-1 text-body text-foreground/80">
                {data.subscription.planName}, {formatMoneyMXN(data.subscription.priceCents)} {data.subscription.intervalLabel}. Se cobra el {formatCompactDate(data.subscription.nextChargeAt)}.
              </p>
              <div className="mt-6 flex items-center gap-4">
                <Badge color="success">Activa</Badge>
                <Link href={previewHref(base, "suscripcion")} className={TEXT_LINK}>
                  Administrar suscripción
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="mt-4 text-section-title text-foreground">Aún no tienes una caja</p>
              <p className="mt-1 max-w-[44ch] text-body text-foreground/80">Cada mes elegimos una caja de skincare para ti y te la enviamos a casa.</p>
              <Link href="/" className={`${CTA_SECONDARY} mt-6 self-start`}>
                Conocer la suscripción
              </Link>
            </>
          )}
        </section>

        <section aria-labelledby="last-order" className={CARD}>
          <h2 id="last-order" className={LABEL}>
            Último pedido
          </h2>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex -space-x-3">
              {lastOrder.lines.slice(0, 3).map((line) => (
                <Thumb key={line.id} product={line} className="h-[70px] w-14 ring-2 ring-surface" sizes="56px" />
              ))}
            </div>
            <div className="min-w-0">
              <p className="font-mono text-data text-foreground">{lastOrder.number}</p>
              <p className="text-body-sm text-muted-foreground-strong">{formatCompactDate(lastOrder.createdAt)}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Badge color={status.color}>{status.label}</Badge>
            <p className="font-mono text-data text-foreground">{formatMoneyMXN(lastOrder.totalCents)}</p>
          </div>
          <Link href={previewHref(base, "pedidos", lastOrder.oxxo ? "oxxo" : "detalle")} className={`${TEXT_LINK} mt-auto self-start pt-4`}>
            Ver pedido
          </Link>
        </section>
      </div>

      <nav aria-label="Secciones de Mi cuenta" className="mt-10 lg:hidden">
        <ul className="grid grid-cols-2 gap-3">
          {ACCOUNT_NAV.map((item) => (
            <li key={item.view}>
              <Link href={previewHref(base, item.view)} className={`flex h-full min-h-28 flex-col gap-2 rounded-md border border-border-strong bg-surface p-4 transition-colors duration-[var(--duration-fast)] hover:bg-muted ${FOCUS}`}>
                <item.icon size={24} aria-hidden="true" />
                <span className="text-subtitle text-foreground">{item.label}</span>
                <span className="text-body-sm text-muted-foreground-strong">{sectionSummary(item.view, data, hasSubscription)}</span>
              </Link>
            </li>
          ))}
          <li>
            <Link href={previewHref(base, "ingresar")} className={`flex h-full min-h-28 flex-col gap-2 rounded-md border border-border bg-transparent p-4 text-muted-foreground-strong transition-colors duration-[var(--duration-fast)] hover:bg-muted ${FOCUS}`}>
              <SignOut size={24} aria-hidden="true" />
              <span className="text-subtitle">Cerrar sesión</span>
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export { HomeA };
