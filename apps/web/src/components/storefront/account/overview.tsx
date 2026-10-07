import Link from "next/link";
import { ORDER_STATUS_LABELS, SubscriptionStatus, type AccountDto, type MySubscription, type PublicOrder } from "@esencia-glow/shared";
import { SignOut } from "@phosphor-icons/react/ssr";
import { Badge } from "@/components/ui/badge";
import { formatMoneyMXN } from "@/lib/format-money";
import { LogoutButton } from "./logout-button";
import { ACCOUNT_NAV } from "./nav-items";
import { formatCompactDate, formatLongDate } from "./shared/dates";
import { Thumb } from "./shared/frame";
import { CTA_SECONDARY, FOCUS, LABEL, TEXT_LINK } from "./shared/styles";
import { ORDER_STATUS_COLOR } from "./sections/order-status";

interface OverviewProps {
  firstName: string;
  account: AccountDto | null;
  subscription: MySubscription | null;
  lastOrder: PublicOrder | null;
  orderTotal: number;
}

const CARD = "flex flex-col rounded-md border border-border-strong bg-surface p-6";

/** Una línea que resume el estado de cada sección (rejilla de accesos del móvil). */
function summaryFor(slug: string, { account, subscription, orderTotal }: OverviewProps): string {
  switch (slug) {
    case "suscripcion":
      if (!subscription) return "Aún no tienes una caja";
      return subscription.status === SubscriptionStatus.ACTIVE && subscription.nextChargeAt ? `Activa. Próximo cobro el ${formatCompactDate(subscription.nextChargeAt)}` : subscription.plan.name;
    case "pedidos":
      return orderTotal === 0 ? "Aún sin pedidos" : `${orderTotal} ${orderTotal === 1 ? "pedido" : "pedidos"}`;
    case "direcciones": {
      const count = account?.addresses.length ?? 0;
      return count === 0 ? "Sin direcciones" : `${count} ${count === 1 ? "dirección" : "direcciones"}`;
    }
    case "perfil":
      return account?.profile.email ?? "";
    case "facturacion":
      return account?.billingInfo ? "Datos fiscales guardados" : "Sin datos fiscales";
    case "guardados": {
      const count = account?.wishlistCount ?? 0;
      return count === 0 ? "Nada guardado" : `${count} ${count === 1 ? "producto" : "productos"}`;
    }
    default:
      return "";
  }
}

/**
 * Inicio de Mi cuenta: lo que importa hoy (la próxima caja y el último pedido) y,
 * solo en móvil, la rejilla de accesos a cada sección. En escritorio la barra
 * lateral ya cumple ese papel.
 */
function Overview(props: OverviewProps) {
  const { firstName, subscription, lastOrder } = props;
  const firstWord = firstName.split(" ")[0] ?? firstName;
  const activeBox = subscription && subscription.status === SubscriptionStatus.ACTIVE && !subscription.cancelAtPeriodEnd ? subscription : null;

  return (
    <div>
      <h1 className="text-page-title text-foreground md:text-display">Hola, {firstWord}</h1>
      <p className="mt-2 max-w-[52ch] text-body text-foreground/80">Esto es lo que pasa con tu cuenta hoy.</p>

      <div className="mt-8 grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <section aria-labelledby="next-box" className={CARD}>
          <h2 id="next-box" className={LABEL}>
            Tu próxima caja
          </h2>
          {activeBox && activeBox.nextChargeAt ? (
            <>
              <p className="mt-4 text-display text-foreground">{formatLongDate(activeBox.nextChargeAt).replace(/ de \d{4}$/, "")}</p>
              <p className="mt-1 text-body text-foreground/80">
                {activeBox.plan.name}, {formatMoneyMXN(activeBox.plan.priceCents)}. Se cobra ese día.
              </p>
              <div className="mt-6 flex items-center gap-4">
                <Badge color="success">Activa</Badge>
                <Link href="/mi-cuenta/suscripcion" className={TEXT_LINK}>
                  Administrar suscripción
                </Link>
              </div>
            </>
          ) : subscription ? (
            <>
              <p className="mt-4 text-section-title text-foreground">{subscription.plan.name}</p>
              <Link href="/mi-cuenta/suscripcion" className={`${TEXT_LINK} mt-4 self-start`}>
                Ver mi suscripción
              </Link>
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
          {lastOrder ? (
            <>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex -space-x-3">
                  {lastOrder.lines.slice(0, 3).map((line) => (
                    <Thumb key={`${line.itemId}-${line.sku}`} name={line.name} image={line.image} className="h-[70px] w-14 ring-2 ring-surface" sizes="56px" />
                  ))}
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-data text-foreground">{lastOrder.orderNumber}</p>
                  <p className="text-body-sm text-muted-foreground-strong">{formatCompactDate(lastOrder.createdAt)}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Badge color={ORDER_STATUS_COLOR[lastOrder.status]}>{ORDER_STATUS_LABELS[lastOrder.status]}</Badge>
                <p className="font-mono text-data text-foreground">{formatMoneyMXN(lastOrder.totals.totalCents)}</p>
              </div>
              <Link href={`/mi-cuenta/pedidos/${lastOrder.id}`} className={`${TEXT_LINK} mt-auto self-start pt-4`}>
                Ver pedido
              </Link>
            </>
          ) : (
            <>
              <p className="mt-4 text-section-title text-foreground">Todavía no has comprado</p>
              <Link href="/" className={`${CTA_SECONDARY} mt-6 self-start`}>
                Ir a la tienda
              </Link>
            </>
          )}
        </section>
      </div>

      <nav aria-label="Secciones de Mi cuenta" className="mt-10 lg:hidden">
        <ul className="grid grid-cols-2 gap-3">
          {ACCOUNT_NAV.map((item) => (
            <li key={item.slug}>
              <Link
                href={item.href}
                className={`flex h-full min-h-28 flex-col gap-2 rounded-md border border-border-strong bg-surface p-4 transition-colors duration-[var(--duration-fast)] hover:bg-muted ${FOCUS}`}
              >
                <item.icon size={24} aria-hidden="true" />
                <span className="text-subtitle text-foreground">{item.label}</span>
                {/* El correo no tiene espacios donde partirse: se recorta con puntos suspensivos. */}
                <span className={`text-body-sm text-muted-foreground-strong ${item.slug === "perfil" ? "truncate" : ""}`}>{summaryFor(item.slug, props)}</span>
              </Link>
            </li>
          ))}
          <li>
            <LogoutButton
              className={`flex h-full min-h-28 w-full cursor-pointer flex-col gap-2 rounded-md border border-border bg-transparent p-4 text-left text-muted-foreground-strong transition-colors duration-[var(--duration-fast)] hover:bg-muted ${FOCUS}`}
            >
              <SignOut size={24} aria-hidden="true" />
              <span className="text-subtitle">Cerrar sesión</span>
            </LogoutButton>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export { Overview };
