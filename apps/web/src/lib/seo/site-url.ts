/**
 * Única fuente de la URL pública de la tienda (canónicas, sitemap, JSON-LD,
 * Open Graph). Se puede sobrescribir con `NEXT_PUBLIC_SITE_URL` (p. ej. un
 * dominio de pruebas); sin ella usa el dominio de producción.
 */
const DEFAULT_SITE_URL = "https://www.esenciaglow.com.mx";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL).replace(/\/$/, "");

const SITE_NAME = "Esencia Glow";

/** "/producto/x" → "https://www.esenciaglow.com.mx/producto/x" (la raíz queda sin barra final). */
function absoluteUrl(path: string): string {
  if (path === "" || path === "/") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export { absoluteUrl, SITE_NAME, SITE_URL };
