import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El panel vive bajo /admin de la misma URL de la tienda (la tienda lo sirve
  // con un rewrite, ver apps/store/next.config.ts). `basePath` hace que
  // <Link>, redirect() y el router prefijen /admin solos; las rutas del panel
  // siguen escritas como /orders, /products, etc.
  // El panel nunca se indexa (ver metadata de robots en el layout admin);
  // esto es solo la config del framework, no reemplaza esa metadata.
  basePath: "/admin",
  reactStrictMode: true,
};

export default nextConfig;
