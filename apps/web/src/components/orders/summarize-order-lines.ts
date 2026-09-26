import type { PublicOrderLine } from "@esencia-glow/shared";

/** "Sérum de Vitamina C +2 más" — nunca la lista completa: la fila de la
 * cola de trabajo no es el lugar para leer cada línea (eso es el 2.3b). */
function summarizeOrderLines(lines: PublicOrderLine[]): string {
  const [first, ...rest] = lines;
  if (!first) return "Sin artículos";
  return rest.length > 0 ? `${first.name} +${rest.length} más` : first.name;
}

export { summarizeOrderLines };
