import type { Metadata } from "next";
import type { ReactNode } from "react";

// Vista previa temporal: nunca debe indexarse.
export const metadata: Metadata = { title: "Vista previa: carrito y checkout", robots: { index: false, follow: false } };

export default function CheckoutPreviewLayout({ children }: { children: ReactNode }) {
  return children;
}
