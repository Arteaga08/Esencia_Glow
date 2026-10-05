import { SuggestedProducts } from "@/components/storefront/catalog/suggested-products";
import type { ProductView } from "@/lib/storefront/product-view";
import { ContentAccordion } from "./content-accordion";
import { ProductCrumbs } from "./product-crumbs";
import { ProductGallery } from "./product-gallery";
import { PurchasePanel } from "./purchase-panel";

/**
 * Página de producto: miniaturas + foto + columna de compra fija (referencia
 * AEVI) y, debajo, la banda rosa "Información del producto" con acordeón
 * (referencia Piel Coreana). Remata con el bloque de sugeridos del catálogo.
 * La banda no aparece si el producto no tiene contenido editorial.
 */
function ProductDetail({ product }: { product: ProductView }) {
  return (
    <main className="pt-16 xl:pt-20">
      <ProductCrumbs product={product} />

      <section className="mx-auto grid max-w-shell gap-8 px-4 pb-20 md:px-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-14 xl:px-12">
        <ProductGallery images={product.images} />
        <div className="lg:sticky lg:top-28 lg:self-start">
          <PurchasePanel product={product} />
        </div>
      </section>

      {product.sections.length > 0 ? (
        <section aria-labelledby="product-info-title" className="bg-blush">
          <div className="mx-auto grid max-w-shell gap-10 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-2 lg:gap-20 xl:px-12">
            <h2 id="product-info-title" className="type-shop-section text-foreground">
              Información del producto
            </h2>
            <ContentAccordion sections={product.sections} />
          </div>
        </section>
      ) : null}

      <SuggestedProducts categorySlug={product.category.slug} activeBrands={[]} excludeIds={[product.id]} />
    </main>
  );
}

export { ProductDetail };
