import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El panel nunca se indexa (ver metadata de robots en el layout admin);
  // esto es solo la config del framework, no reemplaza esa metadata.
  reactStrictMode: true,
};

export default nextConfig;
