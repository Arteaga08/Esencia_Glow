import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/storefront/product/product-detail";
import { ErrorState } from "@/components/ui/error-state";
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
  return {
    title: `${product.name} | Esencia Glow`,
    description: product.shortDescription || product.description,
    openGraph: image ? { images: [{ url: image.url, width: image.width, height: image.height }] } : undefined,
  };
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

  return <ProductDetail product={toProductView(lookup.product, availability)} />;
}
