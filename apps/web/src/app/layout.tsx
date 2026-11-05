import type { Metadata, Viewport } from "next";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Esencia Glow",
  description: "Skincare y lifestyle con suscripción curada.",
};

// Color de la barra del navegador en móvil (Safari en iPhone, Chrome en Android):
// el rosa de la marca, `--color-primary` (oklch(0.77 0.1 355)) en hex, porque la
// meta `theme-color` no lee variables de CSS.
export const viewport: Viewport = {
  themeColor: "#e799b7",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
