"use client";

import Link from "next/link";
import { useState } from "react";
import type { ShelfItem } from "@/lib/storefront/shelf-item";
import { VIEW_ALL_BUTTON } from "./shelf-button-styles";
import { ShelfCarousel } from "./shelf-carousel";
import { ShelfTabs, type ShelfTab } from "./shelf-tabs";

interface ShelfSectionProps {
  products: ShelfItem[];
  kits: ShelfItem[];
}

const TAB_LINKS: Record<string, string> = { products: "/mas-vendidos", kits: "/kits" };

/**
 * Bloque 3 del home: pestañas "Más vendidos" / "Kits" y un carrusel por
 * pestaña. Una pestaña sin elementos no se muestra; sin ninguna, el bloque
 * entero desaparece (no deja un hueco en la portada).
 */
function ShelfSection({ products, kits }: ShelfSectionProps) {
  const tabs: ShelfTab[] = [
    ...(products.length > 0 ? [{ id: "products", label: "Más vendidos" }] : []),
    ...(kits.length > 0 ? [{ id: "kits", label: "Kits" }] : []),
  ];
  const [requested, setActive] = useState(tabs[0]?.id ?? "");
  if (tabs.length === 0) return null;

  const active = tabs.some((tab) => tab.id === requested) ? requested : tabs[0]!.id;
  const items = active === "kits" ? kits : products;

  return (
    <section aria-labelledby={`shelf-tab-${active}`} className="mx-auto max-w-shell px-4 py-16 md:px-8 md:py-24 xl:px-12">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <ShelfTabs tabs={tabs} active={active} onChange={setActive} />
        <Link href={TAB_LINKS[active] ?? "/"} className={VIEW_ALL_BUTTON}>
          Ver todo
        </Link>
      </div>

      <div id="shelf-panel" role="tabpanel" aria-labelledby={`shelf-tab-${active}`}>
        <ShelfCarousel key={active} items={items} />
      </div>

    </section>
  );
}

export { ShelfSection };
