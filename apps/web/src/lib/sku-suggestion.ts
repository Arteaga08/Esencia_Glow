/**
 * Sugerencia de SKU a partir del nombre del producto + el nombre de la
 * variante — nunca se impone: es un punto de partida que el operador puede
 * sobreescribir (a diferencia del `slug`, el SKU es un campo real y
 * editable del backend, único global, `product.validator.ts`). El llamador
 * decide cuándo dejar de regenerarla (ver `skuTouched` en `variant-fields.ts`).
 *
 * Debe caer siempre dentro de `/^[A-Z0-9-]{3,32}$/` (SKU_PATTERN,
 * product-variant.schema.ts) — mayúsculas, sin acentos, sin espacios.
 */

const STOPWORDS = new Set(["DE", "LA", "EL", "LOS", "LAS", "Y", "CON", "PARA", "DEL", "EN", "UN", "UNA"]);

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function significantWords(name: string, max: number): string[] {
  return stripAccents(name)
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean)
    .filter((word) => !STOPWORDS.has(word))
    .slice(0, max);
}

function suggestSku(productName: string, variantName: string): string {
  const base = significantWords(productName, 2).join("-");
  const variantPart = stripAccents(variantName).toUpperCase().replace(/[^A-Z0-9]+/g, "");
  const combined = [base, variantPart].filter(Boolean).join("-");
  return combined.slice(0, 32);
}

export { suggestSku };
