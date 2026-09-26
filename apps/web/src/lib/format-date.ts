/** "25 sep" — fecha corta para filas de tabla/lista, nunca la hora. */
function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

/** "25 sep 2026, 14:32" — fecha y hora exacta, para la bitácora del pedido
 * (2.3b) y cualquier otro lugar donde el minuto exacto importe. */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export { formatShortDate, formatDateTime };
