import { escapeRegex } from "./parse-list-query.js";

// Mayúsculas explícitas: la bandera "i" del motor de Mongo no garantiza
// plegar mayúsculas/minúsculas fuera de ASCII.
const VOWEL_CLASSES: Record<string, string> = {
  a: "[aáÁ]",
  e: "[eéÉ]",
  i: "[iíÍ]",
  o: "[oóÓ]",
  u: "[uúüÚÜ]",
};

/**
 * Patrón del buscador de la tienda: ignora mayúsculas y acentos, porque casi
 * nadie escribe "sérum" con tilde. Cada vocal acepta su versión acentuada
 * ("serum" encuentra "Sérum" y al revés). La ñ se respeta: es otra letra.
 * El texto se escapa antes, así que nunca llega un metacaracter del usuario.
 */
function buildSearchPattern(search: string): RegExp {
  // Quita solo tilde aguda y diéresis (U+0301, U+0308); la virgulilla de la ñ se queda.
  const plain = search.normalize("NFD").replace(/[́̈]/g, "").normalize("NFC");
  const source = escapeRegex(plain).replace(/[aeiou]/gi, (vowel) => VOWEL_CLASSES[vowel.toLowerCase()]!);
  return new RegExp(source, "i");
}

export { buildSearchPattern };
