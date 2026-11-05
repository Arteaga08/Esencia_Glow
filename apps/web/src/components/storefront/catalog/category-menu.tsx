"use client";

import { CaretDown, Check } from "@phosphor-icons/react";
import type { PublicCategoryNode } from "@esencia-glow/shared";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface CategoryMenuProps {
  root: PublicCategoryNode;
  currentSlug: string;
}

/**
 * Selector de subcategoría de la barra del catálogo: el botón muestra dónde se
 * está ("Todo" es la raíz) y despliega la raíz y sus hijas como enlaces. Se
 * muestra también dentro de una subcategoría, para saltar a una hermana sin
 * volver al menú. Cierra con Escape o al tocar fuera. Una raíz sin
 * subcategorías no pinta nada.
 */
function CategoryMenu({ root, currentSlug }: CategoryMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (root.children.length === 0) return null;
  const links = [{ name: "Todo", slug: root.slug }, ...root.children.map((child) => ({ name: child.name, slug: child.slug }))];
  const current = links.find((link) => link.slug === currentSlug) ?? links[0]!;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="catalog-category-menu"
        aria-label={`Subcategoría: ${current.name}`}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm type-shop-cta text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {current.name}
        <CaretDown
          size={14}
          aria-hidden="true"
          className={`transition-transform duration-[var(--duration-base)] ease-out-quart motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
      <nav
        id="catalog-category-menu"
        aria-label={`Subcategorías de ${root.name}`}
        hidden={!open}
        className="absolute left-0 top-full z-40 mt-2 w-64 rounded-md border border-border-strong bg-surface p-2"
      >
        <ul className="flex max-h-[min(24rem,60dvh)] flex-col overflow-y-auto">
          {links.map((link) => {
            const active = link.slug === currentSlug;
            return (
              <li key={link.slug}>
                <Link
                  href={`/categoria/${link.slug}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-11 items-center justify-between gap-3 rounded-md px-3 text-body text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "bg-blush" : ""}`}
                >
                  {link.name}
                  {active ? <Check size={16} weight="bold" aria-hidden="true" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export { CategoryMenu };
