import type { AccountDto } from "@esencia-glow/shared";
import { LoadFailure } from "@/components/storefront/account/shared/load-failure";
import { SectionTitle } from "@/components/storefront/account/shared/section-title";
import { ProfileSection } from "@/components/storefront/account/sections/profile-section";
import { fetchAccountData } from "@/lib/storefront/account-server";

export default async function ProfilePage() {
  const account = await fetchAccountData<AccountDto>("/api/v1/account");
  return (
    <>
      <SectionTitle>Perfil y contraseña</SectionTitle>
      {account.status === "ok" ? <ProfileSection initial={account.data.profile} /> : <LoadFailure status={account.status} what="tu perfil" />}
    </>
  );
}
