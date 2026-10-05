import type { Metadata } from "next";
import type { ReactNode } from "react";

// Vista previa temporal: nunca debe indexarse.
export const metadata: Metadata = { title: "Vista previa: acceso y Mi cuenta", robots: { index: false, follow: false } };

export default function AccountPreviewLayout({ children }: { children: ReactNode }) {
  return children;
}
