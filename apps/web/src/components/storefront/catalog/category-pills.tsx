import Link from "next/link";
import type { PublicCategoryNode } from "@esencia-glow/shared";

const PILL_BASE =
  "inline-flex min-h-10 items-center whitespace-nowrap rounded-md border px-4 type-shop-cta text-foreground " +
  "transition-colors duration-[var(--duration-base)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Subcategorías de la categoría raíz, como pastillas. "Todo" es la raíz; la
 * activa lleva fondo rosa. Se muestran también estando dentro de una
 * subcategoría, para saltar a una hermana sin volver al menú. Una raíz sin
 * subcategorías no pinta nada.
 */
function CategoryPills({ root, currentSlug, className = "" }: { root: PublicCategoryNode; currentSlug: string; className?: string }) {
  if (root.children.length === 0) return null;
  const links = [{ name: "Todo", slug: root.slug }, ...root.children.map((child) => ({ name: child.name, slug: child.slug }))];

  return (
    <nav aria-label={`Subcategorías de ${root.name}`} className={className}>
      <ul className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
        {links.map((link) => {
          const active = link.slug === currentSlug;
          return (
            <li key={link.slug} className="shrink-0">
              <Link
                href={`/categoria/${link.slug}`}
                aria-current={active ? "page" : undefined}
                className={`${PILL_BASE} ${active ? "border-foreground bg-blush" : "border-border-strong bg-surface hover:border-foreground"}`}
              >
                {link.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { CategoryPills };
