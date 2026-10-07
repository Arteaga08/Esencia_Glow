import { PT_Mono, Schibsted_Grotesk } from "next/font/google";

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

// Clases que declaran las dos variables de fuente: las usan el layout raíz y
// `global-error`, que lo reemplaza y por eso debe declararlas por su cuenta.
const fontVariables = `${schibstedGrotesk.variable} ${ptMono.variable}`;

export { fontVariables };
