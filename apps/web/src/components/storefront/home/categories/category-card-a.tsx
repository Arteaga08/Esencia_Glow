import Link from "next/link";
import type { ShowcaseCategory } from "@/lib/storefront/category-showcase";
import { VIEW_ALL_BUTTON } from "../shelf/shelf-button-styles";
import { CategoryImage } from "./category-image";

const SIZES = "(min-width: 1024px) 25vw, (min-width: 640px) 42vw, 72vw";

/**
 * Propuesta A (fiel a la referencia): foto pegada a las vecinas, y debajo,
 * sobre la banda rosa, nombre, descripción y botón centrados.
 */
function CategoryCardA({ category, priority }: { category: ShowcaseCategory; priority: boolean }) {
  return (
    <article className="flex h-full flex-col">
      <Link href={category.href} aria-label={category.name} tabIndex={-1} className="relative block aspect-[9/10] overflow-hidden">
        <CategoryImage category={category} sizes={SIZES} priority={priority} />
      </Link>
      <div className="flex flex-1 flex-col items-center justify-between px-6 pt-6 text-center">
        <h3 className="type-shop-card-title text-foreground">{category.name}</h3>
        {category.description ? (
          <p className="mt-3 line-clamp-2 max-w-[32ch] text-body text-foreground/80">{category.description}</p>
        ) : null}
        <Link href={category.href} aria-label={`Comprar ${category.name}`} className={`${VIEW_ALL_BUTTON} mt-6 mb-12`}>
          Comprar
        </Link>
      </div>
    </article>
  );
}

export { CategoryCardA };
