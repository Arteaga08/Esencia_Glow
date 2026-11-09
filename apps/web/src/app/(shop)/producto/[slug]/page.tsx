import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/storefront/product/product-detail";
import { JsonLdScript } from "@/components/seo/json-ld";
import { ErrorState } from "@/components/ui/error-state";
import { buildBreadcrumbJsonLd, buildProductJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { getProduct, getProductAvailability } from "@/lib/storefront/product";
import { toProductView } from "@/lib/storefront/product-view";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const lookup = await getProduct(slug);
  if (lookup.kind !== "found") return { title: "Producto no encontrado" };

  const { product } = lookup;
  const image = product.images[0];
  return buildPageMetadata({
    title: `${product.name} | Esencia Glow`,
    description: product.shortDescription || product.description,
    path: `/producto/${product.slug}`,
    image: image ? { url: image.url, width: image.width, height: image.height, alt: image.alt ?? product.name } : undefined,
  });
}

/**
 * Detalle de un producto: galería, compra y contenido editorial. Si el slug no
 * existe es un 404; si el API no responde se muestra un error, no un 404.
 */
export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const [lookup, availability] = await Promise.all([getProduct(slug), getProductAvailability(slug)]);

  if (lookup.kind === "not-found") notFound();
  if (lookup.kind === "error" || lookup.product.variants.length === 0) {
    return (
      <main className="mx-auto max-w-shell px-4 pt-32 pb-20 md:px-8 xl:px-12">
        <ErrorState title="No pudimos cargar el producto" description="Intenta de nuevo en unos minutos." />
      </main>
    );
  }

  const view = toProductView(lookup.product, availability);
  const path = `/producto/${view.slug}`;

  return (
    <>
      <JsonLdScript
        data={buildProductJsonLd({
          name: view.name,
          description: view.description,
          path,
          imageUrls: view.images.map((image) => image.url),
          brand: view.brand,
          variants: view.variants.map((variant) => ({ priceCents: variant.priceCents, available: variant.available })),
        })}
      />
      <JsonLdScript
        data={buildBreadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: view.category.name, path: `/categoria/${view.category.slug}` },
          { name: view.name, path },
        ])}
      />
      <ProductDetail product={view} />
    </>
  );
}
