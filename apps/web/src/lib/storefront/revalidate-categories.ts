"use server";

import { updateTag } from "next/cache";
import { CATEGORY_TREE_TAG } from "./category-tree-tag";

/**
 * Invalida la caché del árbol público de categorías. Se llama desde el panel
 * justo después de reordenar, para que la tienda refleje el orden al instante
 * en vez de esperar a que venza la caché de 5 minutos.
 */
async function revalidateCategoryTree(): Promise<void> {
  updateTag(CATEGORY_TREE_TAG);
}

export { revalidateCategoryTree };
