/** "25 sep" — fecha corta para filas de tabla/lista, nunca la hora: el
 * detalle con hora exacta vive en la bitácora del propio pedido. */
function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export { formatShortDate };
