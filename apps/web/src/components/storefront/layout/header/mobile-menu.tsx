"use client";

import { CaretDown, User } from "@phosphor-icons/react";
import type { PublicCategoryNode } from "@esencia-glow/shared";
import Link from "next/link";
import { useState } from "react";

const rowClass =
  "flex min-h-14 w-full items-center justify-between rounded-sm text-page-title text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const subLinkClass =
  "flex min-h-11 items-center rounded-sm text-subtitle text-muted-foreground-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Menú móvil a pantalla completa bajo la barra. Cada categoría con hijos
 * es un acordeón (una abierta a la vez); la cuenta y Ofertas cierran la
 * lista. Cerrado queda `inert` y fuera del flujo de tabulación.
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
      className={`fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto bg-blush px-4 pb-10 pt-4 transition-[opacity,visibility] duration-[var(--duration-slow)] ease-out-quart motion-reduce:transition-none xl:hidden ${open ? "visible opacity-100" : "invisible opacity-0"}`}
    >
      <nav aria-label="Principal móvil">
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
      <Link
        href="/mi-cuenta"
        onClick={onNavigate}
        className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full border border-border-strong px-5 text-subtitle text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <User size={20} aria-hidden="true" />
        Mi cuenta
      </Link>
    </div>
  );
}

export { MobileMenu };
