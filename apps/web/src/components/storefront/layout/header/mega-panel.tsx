import { ArrowRight } from "@phosphor-icons/react/ssr";
import type { PublicCategoryNode } from "@esencia-glow/shared";
import Link from "next/link";

const linkClass =
  "inline-flex min-h-11 items-center rounded-sm text-body text-muted-foreground-strong transition-colors duration-[var(--duration-fast)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none";

/**
 * Panel de subcategorías de la categoría activa. Se despliega debajo de la
 * barra con `grid-template-rows` (0fr → 1fr) en lugar de animar `height`;
 * cerrado queda `inert` para que el teclado no entre a enlaces invisibles.
 */
function MegaPanel({
  id,
  category,
  open,
  onNavigate,
}: {
  id: string;
  category: PublicCategoryNode | null;
  open: boolean;
  onNavigate: () => void;
}) {
  return (
    <div
      id={id}
      inert={!open}
      className={`hidden grid-rows-[0fr] transition-[grid-template-rows] duration-[var(--duration-slow)] ease-out-quart motion-reduce:transition-none xl:grid ${open ? "grid-rows-[1fr]" : ""}`}
    >
      <div className="overflow-hidden">
        {category ? (
          <div
            key={category.id}
            className="mx-auto grid max-w-shell gap-x-12 gap-y-6 border-t border-border px-12 pb-10 pt-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
          >
            <div className="flex flex-col items-start gap-3">
              <p className="text-section-title text-foreground">{category.name}</p>
              {category.description ? (
                <p className="max-w-[40ch] text-body text-muted-foreground-strong">
                  {category.description}
                </p>
              ) : null}
              <Link
                href={`/categoria/${category.slug}`}
                onClick={onNavigate}
                className="inline-flex min-h-11 items-center gap-2 rounded-sm text-body text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Ver todo
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <ul className="grid auto-rows-min grid-cols-2 gap-x-8 2xl:grid-cols-3">
              {category.children.map((child) => (
                <li key={child.id}>
                  <Link
                    href={`/categoria/${category.slug}/${child.slug}`}
                    onClick={onNavigate}
                    className={linkClass}
                  >
                    {child.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { MegaPanel };
