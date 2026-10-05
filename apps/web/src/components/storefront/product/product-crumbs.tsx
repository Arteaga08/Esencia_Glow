import { Breadcrumb } from "@/components/storefront/catalog/breadcrumb";
import type { ProductView } from "@/lib/storefront/product-view";

/** Migas Inicio / Categoría / Producto. */
function ProductCrumbs({ product }: { product: ProductView }) {
  return (
    <div className="mx-auto max-w-shell px-4 py-6 md:px-8 xl:px-12">
      <Breadcrumb
        trail={[{ name: product.category.name, href: `/categoria/${product.category.slug}` }, { name: product.name }]}
      />
    </div>
  );
}

export { ProductCrumbs };
