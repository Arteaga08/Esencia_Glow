import type { NextConfig } from "next";

// Origen interno del panel (apps/web). En dev corre en :3001; en producción
// debe venir del entorno: un fallback a localhost ahí serviría un 502 en /admin.
function readAdminOrigin(): string {
  const raw = process.env.ADMIN_ORIGIN;
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_ORIGIN no está configurada. Ver apps/store/.env.example.");
  }
  return "http://localhost:3001";
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // /admin y todo lo de abajo lo atiende el panel, así la tienda y el panel
  // comparten origen (misma URL, mismas cookies) sin ser una sola app.
  async rewrites() {
    const adminOrigin = readAdminOrigin();
    return [
      { source: "/admin", destination: `${adminOrigin}/admin` },
      { source: "/admin/:path*", destination: `${adminOrigin}/admin/:path*` },
    ];
  },
};

export default nextConfig;
