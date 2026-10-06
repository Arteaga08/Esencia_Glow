import type { AccountDto } from "@esencia-glow/shared";
import { LoadError } from "@/components/storefront/account/shared/load-error";
import { SectionTitle } from "@/components/storefront/account/shared/section-title";
import { AddressesSection } from "@/components/storefront/account/sections/addresses-section";
import { fetchAccountData } from "@/lib/storefront/account-server";

export default async function AddressesPage() {
  const account = await fetchAccountData<AccountDto>("/api/v1/account");
  return (
    <>
      <SectionTitle>Mis direcciones</SectionTitle>
      {account.status === "ok" ? <AddressesSection initial={account.data.addresses} /> : <LoadError what="tus direcciones" />}
    </>
  );
}
