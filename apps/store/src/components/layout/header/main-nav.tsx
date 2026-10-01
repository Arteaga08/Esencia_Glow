"use client";

import { CaretDown } from "@phosphor-icons/react";
import type { PublicCategoryNode } from "@esencia-glow/shared";
import Link from "next/link";

const itemClass =
  "relative inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-sm px-3 text-subtitle text-foreground transition-colors duration-[var(--duration-fast)] after:absolute after:inset-x-3 after:bottom-1.5 after:h-px after:origin-left after:scale-x-0 after:bg-foreground after:transition-transform after:duration-[var(--duration-base)] after:ease-out-quart hover:after:scale-x-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:after:transition-none";

/**
 * Navegación de escritorio: categorías padre + Ofertas. Las que tienen
 * subcategorías son botones de despliegue (abren el panel, patrón
 * disclosure); las que no, enlaces directos. Abrir con el mouse es por
 * intención (`pointerenter`), pero el teclado y el táctil usan clic/Enter.
 */
function MainNav({
  categories,
  activeSlug,
  panelId,
  onActivate,
  onNavigate,
}: {
  categories: PublicCategoryNode[];
  activeSlug: string | null;
  panelId: string;
  onActivate: (slug: string | null) => void;
  onNavigate: () => void;
}) {
  return (
    <nav aria-label="Principal" className="hidden xl:block">
      <ul className="flex items-center gap-1">
        {categories.map((category) => {
          const isOpen = activeSlug === category.slug;
          if (category.children.length === 0) {
            return (
              <li key={category.id} onPointerEnter={() => onActivate(null)}>
                <Link href={`/categoria/${category.slug}`} onClick={onNavigate} className={itemClass}>
                  {category.name}
                </Link>
              </li>
            );
          }
          return (
            <li key={category.id}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => onActivate(isOpen ? null : category.slug)}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") onActivate(category.slug);
                }}
                className={itemClass}
              >
                {category.name}
                <CaretDown
                  size={12}
                  weight="bold"
                  aria-hidden="true"
                  className={`transition-transform duration-[var(--duration-base)] ease-out-quart motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
            </li>
          );
        })}
        <li onPointerEnter={() => onActivate(null)}>
          <Link href="/ofertas" onClick={onNavigate} className={itemClass}>
            Ofertas
          </Link>
        </li>
      </ul>
    </nav>
  );
}

export { MainNav };
