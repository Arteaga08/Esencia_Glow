"use client";

import { CaretDown } from "@phosphor-icons/react";
import type { PublicCategoryNode } from "@esencia-glow/shared";
import Link from "next/link";
import { useState } from "react";
import { MobileMenuFooter } from "./mobile-menu-footer";

const rowClass =
  "flex min-h-14 w-full items-center justify-between rounded-sm text-page-title text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const subLinkClass =
  "flex min-h-11 items-center rounded-sm text-subtitle text-muted-foreground-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Menú móvil a pantalla completa bajo la barra. Cada categoría con hijos
 * es un acordeón (una abierta a la vez) y Ofertas cierra la lista, que es
 * lo único que se desplaza: el pie (WhatsApp y redes) queda
 * fijo al fondo. Cerrado queda `inert` y fuera del flujo de tabulación.
 */
function MobileMenu({
  id,
  open,
  categories,
  onNavigate,
}: {
  id: string;
  open: boolean;
  categories: PublicCategoryNode[];
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div
      id={id}
      inert={!open}
      aria-hidden={!open}
      className={`fixed inset-x-0 bottom-0 top-16 z-40 flex flex-col bg-blush transition-[opacity,visibility] duration-[var(--duration-slow)] ease-out-quart motion-reduce:transition-none xl:hidden ${open ? "visible opacity-100" : "invisible opacity-0"}`}
    >
      <nav aria-label="Principal móvil" className="flex-1 overflow-y-auto px-4 pb-8 pt-4">
        <ul className="flex flex-col divide-y divide-border">
          {categories.map((category) => {
            const isExpanded = expanded === category.slug;
            const panelId = `${id}-${category.slug}`;
            if (category.children.length === 0) {
              return (
                <li key={category.id}>
                  <Link href={`/categoria/${category.slug}`} onClick={onNavigate} className={rowClass}>
                    {category.name}
                  </Link>
                </li>
              );
            }
            return (
              <li key={category.id}>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  onClick={() => setExpanded(isExpanded ? null : category.slug)}
                  className={rowClass}
                >
                  {category.name}
                  <CaretDown
                    size={20}
                    weight="bold"
                    aria-hidden="true"
                    className={`transition-transform duration-[var(--duration-base)] ease-out-quart motion-reduce:transition-none ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>
                <div
                  id={panelId}
                  inert={!isExpanded}
                  className={`grid transition-[grid-template-rows] duration-[var(--duration-slow)] ease-out-quart motion-reduce:transition-none ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <ul className="overflow-hidden">
                    {category.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/categoria/${category.slug}/${child.slug}`}
                          onClick={onNavigate}
                          className={subLinkClass}
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                    <li className="pb-3">
                      <Link
                        href={`/categoria/${category.slug}`}
                        onClick={onNavigate}
                        className={`${subLinkClass} text-foreground underline underline-offset-4`}
                      >
                        Ver todo
                      </Link>
                    </li>
                  </ul>
                </div>
              </li>
            );
          })}
          <li>
            <Link href="/ofertas" onClick={onNavigate} className={rowClass}>
              Ofertas
            </Link>
          </li>
        </ul>
      </nav>
      <MobileMenuFooter />
    </div>
  );
}

export { MobileMenu };
