/**
 * Lógica pura del `TagInput`, separada del componente para poder probarla sin
 * DOM. Dos etiquetas son la misma si solo cambian mayúsculas o espacios.
 */

function normalizeTag(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function hasTag(tags: string[], candidate: string): boolean {
  const key = normalizeTag(candidate).toLowerCase();
  return tags.some((tag) => tag.toLowerCase() === key);
}

/**
 * Agrega lo escrito a la lista. El texto puede traer varias etiquetas
 * separadas por coma (pegar "Seca, Mixta"). Si ya existe una sugerencia igual,
 * se usa su forma escrita para no guardar "seca" y "Seca" como dos distintas.
 */
function addTags(tags: string[], raw: string, suggestions: string[], maxTags: number, maxLength: number): string[] {
  const next = [...tags];
  for (const piece of raw.split(",")) {
    const tag = normalizeTag(piece).slice(0, maxLength);
    if (tag === "" || hasTag(next, tag) || next.length >= maxTags) continue;
    const known = suggestions.find((suggestion) => suggestion.toLowerCase() === tag.toLowerCase());
    next.push(known ?? tag);
  }
  return next;
}

export { normalizeTag, hasTag, addTags };
