"use client";

import { CaretDown } from "@phosphor-icons/react";
import type { PublicCategoryNode } from "@esencia-glow/shared";
import Link from "next/link";

const itemClass =
  "relative inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-sm px-3 text-subtitle text-foreground transition-colors duration-[var(--duration-fast)] after:absolute after:inset-x-3 after:bottom-1.5 after:h-px after:origin-left after:scale-x-0 after:bg-foreground after:transition-transform after:duration-[var(--duration-base)] after:ease-out-quart hover:after:scale-x-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:after:transition-none";

/**
 * Navegación de escritorio: categorías padre + Ofertas. Todas son enlaces a
 * su página (ver todo de la categoría). Las que tienen subcategorías además
 * despliegan el panel: con el mouse por intención (`pointerenter`) y con el
 * teclado al recibir el foco; en táctil el toque navega directo.
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
          const hasChildren = category.children.length > 0;
          return (
            <li
              key={category.id}
              onPointerEnter={(event) => {
                if (!hasChildren) onActivate(null);
                else if (event.pointerType === "mouse") onActivate(category.slug);
              }}
            >
              <Link
                href={`/categoria/${category.slug}`}
                aria-expanded={hasChildren ? isOpen : undefined}
                aria-controls={hasChildren ? panelId : undefined}
                onClick={onNavigate}
                onFocus={(event) => {
                  // Solo foco de teclado: el del clic no debe reabrir el panel.
                  if (hasChildren && event.currentTarget.matches(":focus-visible")) {
                    onActivate(category.slug);
                  }
                }}
                className={itemClass}
              >
                {category.name}
                {hasChildren ? (
                  <CaretDown
                    size={12}
                    weight="bold"
                    aria-hidden="true"
                    className={`transition-transform duration-[var(--duration-base)] ease-out-quart motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
                  />
                ) : null}
              </Link>
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
