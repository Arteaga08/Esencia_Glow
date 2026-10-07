import { Badge, type BadgeColorValue } from "@/components/ui/badge";
import { PriceTag } from "@/components/storefront/home/shelf/price-tag";

interface ProductHeadingProps {
  /** Marca sobre el título; un kit no la lleva. */
  brand?: string;
  badge?: { text: string; color: string };
  name: string;
  priceCents: number;
  /** Precio tachado, solo presentación. */
  listPriceCents?: number;
  available: boolean;
}

/** Marca, nombre, badge, precio y disponibilidad: lo comparten la ficha de producto y la de kit. */
function ProductHeading({ brand, badge, name, priceCents, listPriceCents, available }: ProductHeadingProps) {
  return (
    <header>
      <div className="flex min-h-6 items-center justify-between gap-3">
        {brand ? <p className="font-mono text-label uppercase text-muted-foreground-strong">{brand}</p> : <span />}
        {badge ? <Badge color={badge.color as BadgeColorValue}>{badge.text}</Badge> : null}
      </div>
      <h1 className="mt-2 text-page-title text-foreground md:text-display">{name}</h1>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <PriceTag priceCents={priceCents} listPriceCents={listPriceCents} className="!text-subtitle" />
        <p className="text-body-sm text-muted-foreground-strong">{available ? "Disponible" : "Agotado por ahora"}</p>
      </div>
    </header>
  );
}

export { ProductHeading };
