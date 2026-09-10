import type { ListSort } from "@esencia-glow/shared";

/**
 * Traduce un `ListSort` ya parseado (ver parse-list-query.ts) a la forma que
 * espera `.sort()` de Mongoose, validando el campo contra una whitelist por
 * listado. Un campo fuera de la whitelist (`?sort=password`, `?sort=__proto__`)
 * cae al fallback en silencio — nunca llega a Mongo un campo arbitrario.
 *
 * El desempate por `_id` en la misma dirección evita que un documento salte
 * de página cuando varios comparten el valor del campo de orden (frecuente
 * con datos sembrados en lote que comparten `createdAt`).
 */
function resolveSort(
  sort: ListSort,
  allowed: readonly string[],
  fallback: string,
): Record<string, 1 | -1> {
  const direction: 1 | -1 = sort.direction === "desc" ? -1 : 1;
  const field = allowed.includes(sort.field) ? sort.field : fallback;
  return { [field]: direction, _id: direction };
}

export { resolveSort };
