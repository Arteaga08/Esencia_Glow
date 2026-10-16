import type { NextConfig } from "next";
import { buildCloudinaryRemotePattern } from "./src/lib/cloudinary-image-pattern";

const nextConfig: NextConfig = {
  // El panel vive físicamente bajo src/app/admin (rutas /admin/...), sin
  // basePath. El panel nunca se indexa (ver metadata de robots en el layout
  // admin); esto es solo la config del framework, no reemplaza esa metadata.
  reactStrictMode: true,
  // Sin la cabecera `X-Powered-By: Next.js`: no aporta nada y anuncia el framework.
  poweredByHeader: false,
  // Las fotos del home (hero, etc.) las sube el panel a Cloudinary. Solo se
  // optimizan las de la cuenta de la tienda (ver cloudinary-image-pattern.ts);
  // sin CLOUDINARY_CLOUD_NAME el build y `next dev` fallan a propósito.
  images: {
    remotePatterns: [buildCloudinaryRemotePattern(process.env.CLOUDINARY_CLOUD_NAME)],
    // 85 solo para el banner de categoría y los encabezados de listado (foto a todo el ancho); el resto usa el 75 por defecto.
    qualities: [75, 85],
    // Las URLs de Cloudinary llevan la versión (`/v1790.../`): reemplazar una foto
    // en el panel genera una URL nueva, así que la optimizada puede cachearse un
    // mes (el default son 60 s y obliga a revalidar `/_next/image` casi siempre).
    minimumCacheTTL: 60 * 60 * 24 * 31,
  },
  experimental: {
    // Mismo tope que el API al procesar subidas (upload.service.ts): 40 MP. El
    // default de Next (~268 MP) deja decodificar imágenes enormes.
    imgOptMaxInputPixels: 40_000_000,
  },
  // Los enlaces de los correos llevan un token de un solo uso en la URL: sin
  // Referrer-Policy, un recurso externo cargado por esas páginas lo recibiría
  // en la cabecera Referer. `no-referrer` + sin caché cierra esa fuga.
  async headers() {
    const tokenPageHeaders = [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "no-store" },
    ];
    return [
      { source: "/verificar-correo", headers: tokenPageHeaders },
      { source: "/restablecer-contrasena", headers: tokenPageHeaders },
    ];
  },
};

export default nextConfig;
