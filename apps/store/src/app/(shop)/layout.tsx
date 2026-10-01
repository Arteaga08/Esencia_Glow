import type { ReactNode } from "react";
import { SiteHeader } from "../../components/layout/header/site-header";

// El footer (3.1.10) se monta aquí al final, una sección a la vez.
export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
