/**
 * Recorta un `fieldErrors` de `ApiRequestError` (rutas punteadas, ej.
 * `variants.0.dimensionsCm.length`) a las que empiezan con un prefijo, y les
 * quita ese prefijo — así una fila de variante o un bloque de contenido
 * recibe sus propios errores como si fueran la respuesta de un formulario
 * chico, sin que el componente sepa nada de en qué posición del arreglo vive.
 */
function scopeErrors(errors: Record<string, string> | undefined, prefix: string): Record<string, string> {
  if (!errors) return {};
  const scoped: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) {
    if (key.startsWith(prefix)) scoped[key.slice(prefix.length)] = message;
  }
  return scoped;
}

export { scopeErrors };
