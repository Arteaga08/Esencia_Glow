import type { Metadata } from "next";
import { PT_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

// Pesos verificados contra la API de Google Fonts en el Milestone 2.0:
// PT Mono solo tiene 400 (sin itálica); Schibsted Grotesk sí tiene 400/500/600.
const schibstedGrotesk = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-schibsted-grotesk",
  display: "swap",
});

const ptMono = PT_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-pt-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Esencia Glow — Panel",
  description: "Panel administrativo de Esencia Glow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${schibstedGrotesk.variable} ${ptMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
