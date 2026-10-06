import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthShell } from "@/components/storefront/account/auth/auth-shell";
import { getHomeContent } from "@/lib/storefront/home";

// Pantallas de cuenta: nunca se indexan.
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Marco partido de las pantallas de acceso, con la foto del hero del home. */
export default async function AccessLayout({ children }: { children: ReactNode }) {
  const home = await getHomeContent();
  const slide = home?.hero?.slides[0];
  const photo = slide ? { url: slide.images.desktop.url, alt: "" } : null;

  return <AuthShell photo={photo}>{children}</AuthShell>;
}
