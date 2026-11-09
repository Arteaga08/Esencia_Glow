import type { Metadata } from "next";
import { SITE_NAME } from "./site-url";

interface PageMetadataImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

interface PageMetadataInput {
  /** Título completo, p. ej. "Kits | Esencia Glow". */
  title: string;
  description: string;
  /** Ruta canónica sin querystring, p. ej. `/categoria/rostro`. */
  path: string;
  /** Foto al compartir; sin ella se usa la imagen global de la tienda. */
  image?: PageMetadataImage;
  /** Para páginas que no deben aparecer en Google (p. ej. listados filtrados). */
  noIndex?: boolean;
}

// Imagen global (`app/opengraph-image.jpg`): el `openGraph` de una página
// reemplaza al del layout completo, así que el respaldo se declara aquí.
const FALLBACK_IMAGE: PageMetadataImage = { url: "/opengraph-image.jpg", width: 1200, height: 630 };

/**
 * Metadata de una página pública: canónica, Open Graph y Twitter coherentes
 * entre sí. La URL canónica ignora filtros y paginación para no duplicar contenido.
 */
function buildPageMetadata({ title, description, path, image, noIndex }: PageMetadataInput): Metadata {
  const cover = image ?? FALLBACK_IMAGE;
  return {
    title,
    description,
    alternates: { canonical: path },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "es_MX",
      type: "website",
      images: [cover],
    },
    twitter: { card: "summary_large_image", title, description, images: [cover.url] },
  };
}

export { buildPageMetadata };
export type { PageMetadataImage, PageMetadataInput };
