import { Badge, type BadgeColorValue } from "@/components/ui/badge";
import { PriceTag } from "@/components/storefront/home/shelf/price-tag";
import type { ProductView, ProductViewVariant } from "@/lib/storefront/product-view";

/** Marca, nombre, badge, precio de la presentación elegida y su disponibilidad. */
function ProductHeading({ product, variant }: { product: ProductView; variant: ProductViewVariant }) {
  return (
    <header>
      <div className="flex min-h-6 items-center justify-between gap-3">
        {product.brand ? <p className="font-mono text-label uppercase text-muted-foreground-strong">{product.brand}</p> : <span />}
        {product.badge ? <Badge color={product.badge.color as BadgeColorValue}>{product.badge.text}</Badge> : null}
      </div>
      <h1 className="mt-2 text-page-title text-foreground md:text-display">{product.name}</h1>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <PriceTag priceCents={variant.priceCents} listPriceCents={variant.listPriceCents} className="!text-subtitle" />
        <p className="text-body-sm text-muted-foreground-strong">{variant.available ? "Disponible" : "Agotado por ahora"}</p>
      </div>
    </header>
  );
}

export { ProductHeading };
