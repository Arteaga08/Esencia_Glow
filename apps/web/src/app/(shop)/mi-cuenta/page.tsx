import type { AccountDto, MySubscription, PaginationMeta, PublicOrder } from "@esencia-glow/shared";
import { LoadFailure } from "@/components/storefront/account/shared/load-failure";
import { Overview } from "@/components/storefront/account/overview";
import { fetchAccountData } from "@/lib/storefront/account-server";
import { getCustomerSession } from "@/lib/storefront/customer-session";

/** Resumen: próxima caja y último pedido; en móvil, la rejilla de accesos. */
export default async function AccountHomePage() {
  const session = await getCustomerSession();
  if (!session) return null;

  const [account, subscription, orders] = await Promise.all([
    fetchAccountData<AccountDto>("/api/v1/account"),
    fetchAccountData<{ subscription: MySubscription | null }>("/api/v1/subscriptions/me"),
    fetchAccountData<PublicOrder[], PaginationMeta>("/api/v1/orders", { limit: 1 }),
  ]);

  // La cuenta es lo mínimo para pintar algo útil; pedidos y suscripción degradan a "vacío".
  if (account.status !== "ok") return <LoadFailure status={account.status} what="tu cuenta" />;

  return (
    <Overview
      firstName={session.user.firstName}
      account={account.data}
      subscription={subscription.status === "ok" ? subscription.data.subscription : null}
      lastOrder={orders.status === "ok" ? (orders.data[0] ?? null) : null}
      orderTotal={orders.status === "ok" ? (orders.meta?.total ?? 0) : 0}
    />
  );
}
