import type { AccountDto } from "@esencia-glow/shared";
import { LoadError } from "@/components/storefront/account/shared/load-error";
import { SectionTitle } from "@/components/storefront/account/shared/section-title";
import { BillingSection } from "@/components/storefront/account/sections/billing-section";
import { fetchAccountData } from "@/lib/storefront/account-server";

export default async function BillingPage() {
  const account = await fetchAccountData<AccountDto>("/api/v1/account");
  return (
    <>
      <SectionTitle>Datos de facturación</SectionTitle>
      {account.status === "ok" ? <BillingSection initial={account.data.billingInfo} /> : <LoadError what="tus datos de facturación" />}
    </>
  );
}
