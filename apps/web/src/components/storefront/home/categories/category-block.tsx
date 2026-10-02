import { getShowcaseCategories } from "../../../../lib/storefront/category-showcase";
import { CategorySection } from "./category-section";

/**
 * Bloque 4 del home. Carga las categorías raíz; si el API cae o no hay
 * ninguna, el bloque simplemente no se pinta (ver `CategorySection`).
 */
async function CategoryBlock() {
  const categories = await getShowcaseCategories();
  return <CategorySection categories={categories} />;
}

export { CategoryBlock };
