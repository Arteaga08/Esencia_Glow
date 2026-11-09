import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/site-url";
import { getHomeBrands } from "@/lib/storefront/brands";
import { getCategoryTree } from "@/lib/storefront/categories";
import { getKitSlugs, getProductSlugs } from "@/lib/storefront/sitemap-data";

// Se regenera cada hora (el catálogo lo edita Manuel desde el panel).
export const revalidate = 3600;

type Entry = MetadataRoute.Sitemap[number];

const STATIC_PAGES: Array<{ path: string; priority: number; changeFrequency: Entry["changeFrequency"] }> = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/kits", priority: 0.8, changeFrequency: "weekly" },
  { path: "/mas-vendidos", priority: 0.8, changeFrequency: "weekly" },
  { path: "/novedades", priority: 0.8, changeFrequency: "weekly" },
  { path: "/ofertas", priority: 0.7, changeFrequency: "weekly" },
  { path: "/suscripcion", priority: 0.7, changeFrequency: "monthly" },
  { path: "/contacto", priority: 0.4, changeFrequency: "yearly" },
  { path: "/envios", priority: 0.3, changeFrequency: "yearly" },
  { path: "/devoluciones", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terminos", priority: 0.2, changeFrequency: "yearly" },
  { path: "/privacidad", priority: 0.2, changeFrequency: "yearly" },
  { path: "/cookies", priority: 0.2, changeFrequency: "yearly" },
];

async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [productSlugs, kitSlugs, categories, brands] = await Promise.all([
    getProductSlugs(),
    getKitSlugs(),
    getCategoryTree(),
    getHomeBrands(),
  ]);

  const categorySlugs = categories.flatMap((root) => [root.slug, ...root.children.map((child) => child.slug)]);

  return [
    ...STATIC_PAGES.map(({ path, priority, changeFrequency }) => ({ url: absoluteUrl(path), priority, changeFrequency })),
    ...categorySlugs.map((slug) => ({ url: absoluteUrl(`/categoria/${slug}`), priority: 0.8, changeFrequency: "weekly" as const })),
    ...brands.map((brand) => ({ url: absoluteUrl(`/marca/${brand.slug}`), priority: 0.6, changeFrequency: "weekly" as const })),
    ...productSlugs.map((slug) => ({ url: absoluteUrl(`/producto/${slug}`), priority: 0.9, changeFrequency: "weekly" as const })),
    ...kitSlugs.map((slug) => ({ url: absoluteUrl(`/kit/${slug}`), priority: 0.8, changeFrequency: "weekly" as const })),
  ];
}

export default sitemap;
