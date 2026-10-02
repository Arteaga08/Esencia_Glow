import "server-only";
import { getCategoryTree } from "./categories";

/** Categoría raíz tal como la pinta el bloque "Compra por categoría". */
interface ShowcaseCategory {
  id: string;
  name: string;
  href: string;
  description?: string;
  image?: { url: string; alt?: string };
}

/**
 * Las categorías raíz del árbol público, en su `sortOrder`. Foto y
 * descripción las carga Manuel desde el panel; sin ellas, la tarjeta cae a un
 * bloque rosa con el nombre (ver `CategoryImage`).
 */
async function getShowcaseCategories(): Promise<ShowcaseCategory[]> {
  const tree = await getCategoryTree();
  return tree.map((category) => ({
    id: category.id,
    name: category.name,
    href: `/categoria/${category.slug}`,
    description: category.description,
    image: category.image ? { url: category.image.url, alt: category.image.alt } : undefined,
  }));
}

export { getShowcaseCategories };
export type { ShowcaseCategory };
