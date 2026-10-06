/** "5 de noviembre de 2026" */
function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** "5 oct 2026" */
function formatCompactDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).replace(".", "");
}

/** "33 1234 5678" a partir de 10 dígitos. */
function formatPhone(digits: string): string {
  return digits.length === 10 ? `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}` : digits;
}

export { formatLongDate, formatCompactDate, formatPhone };
