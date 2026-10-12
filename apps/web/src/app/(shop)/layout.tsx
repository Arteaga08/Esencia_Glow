import type { ReactNode } from "react";
import { CartDrawer } from "../../components/storefront/cart/cart-drawer";
import { SiteFooter } from "../../components/storefront/layout/footer/site-footer";
import { SiteHeader } from "../../components/storefront/layout/header/site-header";

export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <div className="contents storefront-labels">
      <SiteHeader />
      {children}
      <SiteFooter />
      <CartDrawer />
    </div>
  );
}
