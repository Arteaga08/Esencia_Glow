import type { ReactNode } from "react";
import { SiteFooter } from "../../components/storefront/layout/footer/site-footer";
import { SiteHeader } from "../../components/storefront/layout/header/site-header";

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
