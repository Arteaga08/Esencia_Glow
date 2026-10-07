import Image from "next/image";
import Link from "next/link";
import type { KitViewItem } from "@/lib/storefront/kit-view";
import { FOCUS } from "@/components/storefront/product/product-styles";

const ROW = "flex items-center gap-4 rounded-md border border-border bg-surface p-3";

function ItemRow({ item }: { item: KitViewItem }) {
  const body = (
    <>
      <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted">
        {item.image ? (
          <Image src={item.image.url} alt="" fill sizes="80px" className="object-cover" />
        ) : (
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-mono text-subtitle text-muted-foreground-strong">
            {item.name.charAt(0)}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-body text-foreground">{item.name}</p>
        {item.presentation ? <p className="mt-0.5 text-body-sm text-muted-foreground-strong">{item.presentation}</p> : null}
      </div>
      <p className="shrink-0 font-mono text-data tabular-nums text-foreground" aria-label={`Cantidad: ${item.quantity}`}>
        ×{item.quantity}
      </p>
    </>
  );

  return item.href ? (
    <Link href={item.href} className={`${ROW} cursor-pointer transition-colors duration-[var(--duration-base)] ease-out-quart hover:border-foreground hover:bg-blush/40 ${FOCUS}`}>
      {body}
    </Link>
  ) : (
    <div className={ROW}>{body}</div>
  );
}

/** "Qué incluye": los productos del kit con foto, presentación y cantidad; cada uno enlaza a su ficha si está publicado. */
function KitContents({ items }: { items: KitViewItem[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="kit-contents-title" className="mx-auto max-w-shell px-4 pb-20 md:px-8 xl:px-12">
      <h2 id="kit-contents-title" className="type-shop-section text-foreground">
        Qué incluye
      </h2>
      <ul className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.key}>
            <ItemRow item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export { KitContents };
