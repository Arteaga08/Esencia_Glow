import type { MySubscription } from "@esencia-glow/shared";
import { LoadError } from "@/components/storefront/account/shared/load-error";
import { SectionTitle } from "@/components/storefront/account/shared/section-title";
import { SubscriptionSection } from "@/components/storefront/account/sections/subscription-section";
import { fetchAccountData } from "@/lib/storefront/account-server";

export default async function SubscriptionPage() {
  const result = await fetchAccountData<{ subscription: MySubscription | null }>("/api/v1/subscriptions/me");
  return (
    <>
      <SectionTitle>Mi suscripción</SectionTitle>
      {result.status === "ok" ? <SubscriptionSection initial={result.data.subscription} /> : <LoadError what="tu suscripción" />}
    </>
  );
}
