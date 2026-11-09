import { absoluteUrl, SITE_NAME, SITE_URL } from "./site-url";

/** Objeto JSON-LD ya armado; se serializa en `components/seo/json-ld.tsx`. */
type JsonLd = Record<string, unknown>;

interface JsonLdOfferVariant {
  priceCents: number;
  available: boolean;
}

interface JsonLdProductInput {
  name: string;
  description: string;
  /** Ruta de la página, p. ej. `/producto/limpiador`. */
  path: string;
  imageUrls: string[];
  brand?: string;
  variants: JsonLdOfferVariant[];
}

interface BreadcrumbItem {
  name: string;
  /** Ruta de la página; se vuelve absoluta aquí. */
  path: string;
}

const SCHEMA_CONTEXT = "https://schema.org";
// Separadores de línea Unicode: válidos en JSON pero rompen un <script> en navegadores viejos.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/** Centavos → pesos con dos decimales, como pide schema.org (`"349.00"`). */
function centsToPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** `Organization` de la tienda en línea: sin dirección física (no hay local). */
function buildOrganizationJsonLd(socialUrls: string[]): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/brand/logo.png"),
    sameAs: socialUrls,
  };
}

function buildWebSiteJsonLd(): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "es-MX",
  };
}

/**
 * Oferta de un producto o kit en MXN. Una sola variante (o varias al mismo
 * precio) es `Offer`; con precios distintos, `AggregateOffer` con el rango.
 * Disponible si al menos una variante se puede comprar hoy. Sin variantes no
 * hay oferta que declarar.
 */
function buildOffer(variants: JsonLdOfferVariant[], url: string): JsonLd | undefined {
  if (variants.length === 0) return undefined;
  const prices = variants.map((variant) => variant.priceCents);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const availability = variants.some((variant) => variant.available) ? `${SCHEMA_CONTEXT}/InStock` : `${SCHEMA_CONTEXT}/OutOfStock`;

  if (low === high) {
    return { "@type": "Offer", url, priceCurrency: "MXN", price: centsToPrice(low), availability };
  }
  return {
    "@type": "AggregateOffer",
    url,
    priceCurrency: "MXN",
    lowPrice: centsToPrice(low),
    highPrice: centsToPrice(high),
    offerCount: variants.length,
    availability,
  };
}

function buildProductJsonLd(input: JsonLdProductInput): JsonLd {
  const url = absoluteUrl(input.path);
  const offers = buildOffer(input.variants, url);
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Product",
    name: input.name,
    description: input.description,
    url,
    ...(input.imageUrls.length > 0 ? { image: input.imageUrls } : {}),
    ...(input.brand ? { brand: { "@type": "Brand", name: input.brand } } : {}),
    ...(offers ? { offers } : {}),
  };
}

function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/**
 * Serializa para incrustar en un `<script>`: escapa `<`, `>`, `&` y los
 * separadores de línea Unicode para que un texto editable desde el panel (p. ej.
 * `</script>` en una descripción) no pueda cerrar la etiqueta ni inyectar HTML.
 */
function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .split(LINE_SEPARATOR)
    .join("\\u2028")
    .split(PARAGRAPH_SEPARATOR)
    .join("\\u2029");
}

export { buildBreadcrumbJsonLd, buildOrganizationJsonLd, buildProductJsonLd, buildWebSiteJsonLd, serializeJsonLd };
export type { BreadcrumbItem, JsonLd, JsonLdProductInput };
