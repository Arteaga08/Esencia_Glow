import { getCategoryTree } from "../../../../lib/storefront/categories";
import { HeaderShell } from "./header-shell";

/** Server Component: pide el árbol de categorías y se lo pasa al header interactivo. */
async function SiteHeader() {
  const categories = await getCategoryTree();
  return <HeaderShell categories={categories} />;
}

export { SiteHeader };
