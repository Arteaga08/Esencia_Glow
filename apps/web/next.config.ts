import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El panel vive físicamente bajo src/app/admin (rutas /admin/...), sin
  // basePath. El panel nunca se indexa (ver metadata de robots en el layout
  // admin); esto es solo la config del framework, no reemplaza esa metadata.
  reactStrictMode: true,
  // Las fotos del home (hero, etc.) las sube el panel a Cloudinary.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
    // 90 solo para el banner de categoría (foto a todo el ancho); el resto usa el 75 por defecto.
    qualities: [75, 90],
  },
};

export default nextConfig;
