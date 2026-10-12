import type { ReactNode } from "react";
import { AnnouncementBar } from "../../components/storefront/layout/announcement/announcement-bar";
import { CartDrawer } from "../../components/storefront/cart/cart-drawer";
import { SiteFooter } from "../../components/storefront/layout/footer/site-footer";
import { SiteHeader } from "../../components/storefront/layout/header/site-header";

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      {children}
      <SiteFooter />
      <CartDrawer />
    </>
  );
}
