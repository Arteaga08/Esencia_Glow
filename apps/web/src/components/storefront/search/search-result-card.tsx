import Image from "next/image";
import Link from "next/link";
import type { ShelfItem } from "@/lib/storefront/shelf-item";
import { PriceTag } from "../home/shelf/price-tag";

const IMAGE_SIZES = "(min-width: 768px) 18vw, 80px";

/**
 * Resultado del buscador. Toda la tarjeta es un solo enlace al producto. En
 * móvil es un renglón (foto chica a la izquierda); desde `md` es una tarjeta
 * vertical para que quepan cinco por fila.
 */
function SearchResultCard({ item, onNavigate }: { item: ShelfItem; onNavigate: () => void }) {
  const image = item.images[0];

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className="group flex items-center gap-4 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring md:flex-col md:items-stretch md:gap-3"
    >
      <div className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-md bg-muted md:w-full">
        {image ? (
          <Image
            src={image.url}
            alt=""
            fill
            sizes={IMAGE_SIZES}
            className="object-cover transition-transform duration-[var(--duration-slow)] ease-out-quart group-hover:scale-[1.03] motion-reduce:transition-none"
          />
        ) : (
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-mono text-subtitle text-muted-foreground-strong">
            {item.name.charAt(0)}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {item.brand ? <p className="font-mono text-label uppercase text-muted-foreground-strong">{item.brand}</p> : null}
        <p className="line-clamp-2 text-subtitle text-foreground underline-offset-4 group-hover:underline">{item.name}</p>
        <PriceTag priceCents={item.priceCents} listPriceCents={item.listPriceCents} />
      </div>
    </Link>
  );
}

export { SearchResultCard };
