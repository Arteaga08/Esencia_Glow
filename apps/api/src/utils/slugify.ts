const MAX_SLUG_LENGTH = 80;
// Marcas diacríticas combinantes que deja NFD tras separar un carácter
// acentuado (á -> a + U+0301). Escape explícito en vez del carácter literal
// para que el archivo no lleve bytes invisibles en el fuente.
const COMBINING_DIACRITICS = /[\u0300-\u036f]/g;

/**
 * Deriva un slug URL-safe de un nombre visible. Nunca se acepta un slug del
 * cliente: siempre se calcula aquí a partir de `name`, así que dos productos
 * con el mismo nombre chocan en el índice único de Mongo con un mensaje claro,
 * en vez de colisionar en silencio.
 */
function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

export { slugify };
