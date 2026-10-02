import { getShelfKits, getShelfProducts } from "../../../../lib/storefront/shelf";
import { ShelfSection } from "./shelf-section";

/**
 * Bloque 3 del home. Carga los productos marcados como "Más vendido" y los
 * paquetes publicados; si el API cae o no hay nada que mostrar, el bloque
 * simplemente no se pinta (ver `ShelfSection`).
 */
async function ShelfBlock() {
  const [products, kits] = await Promise.all([getShelfProducts(), getShelfKits()]);
  return <ShelfSection products={products} kits={kits} />;
}

export { ShelfBlock };
