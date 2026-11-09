import type { MetadataRoute } from "next";

// Marfil del logo: fondo del ícono y del splash, para que el dorado resalte.
const BACKGROUND_COLOR = "#FBF6F0";
// Mismo rosa que `viewport.themeColor` en layout.tsx (barra del sistema).
const THEME_COLOR = "#e799b7";

function manifest(): MetadataRoute.Manifest {
  return {
    name: "Esencia Glow",
    short_name: "Esencia Glow",
    description: "Skincare y lifestyle con suscripción curada.",
    start_url: "/",
    display: "standalone",
    lang: "es",
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

export default manifest;
