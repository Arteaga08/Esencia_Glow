import type { WishlistItem } from "@esencia-glow/shared";
import { LoadFailure } from "@/components/storefront/account/shared/load-failure";
import { SectionTitle } from "@/components/storefront/account/shared/section-title";
import { SavedSection } from "@/components/storefront/account/sections/saved-section";
import { fetchAccountData } from "@/lib/storefront/account-server";

export default async function SavedPage() {
  const saved = await fetchAccountData<WishlistItem[]>("/api/v1/account/wishlist");
  return (
    <>
      <SectionTitle>Guardados</SectionTitle>
      {saved.status === "ok" ? <SavedSection initial={saved.data} /> : <LoadFailure status={saved.status} what="tus guardados" />}
    </>
  );
}
