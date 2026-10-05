import Image from "next/image";
import type { ShowcaseCategory } from "@/lib/storefront/category-showcase";

interface CategoryImageProps {
  category: ShowcaseCategory;
  sizes: string;
  priority?: boolean;
  /** Calidad de compresión de next/image (por defecto la de Next, 75). */
  quality?: number;
  className?: string;
}

/**
 * Foto de la categoría. Sin foto cargada cae al rosa `blush` liso: no se
 * inventa una imagen, y el nombre sigue legible en la tarjeta.
 */
function CategoryImage({ category, sizes, priority = false, quality, className = "" }: CategoryImageProps) {
  if (!category.image) return <div aria-hidden="true" className="absolute inset-0 bg-blush" />;
  return (
    <Image
      src={category.image.url}
      alt={category.image.alt ?? ""}
      fill
      sizes={sizes}
      priority={priority}
      quality={quality}
      className={`object-cover ${className}`}
    />
  );
}

export { CategoryImage };
