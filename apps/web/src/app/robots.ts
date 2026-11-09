import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/site-url";

// Rutas privadas o sin contenido propio: no hay nada que indexar (y varias
// además llevan `noindex` en su propia metadata).
const PRIVATE_PATHS = [
  "/admin",
  "/mi-cuenta",
  "/carrito",
  "/checkout",
  "/ingresar",
  "/crear-cuenta",
  "/recuperar-contrasena",
  "/restablecer-contrasena",
  "/verificar-correo",
  "/design-preview",
  "/api",
];

function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

export default robots;
