import { OverviewRange } from "@esencia-glow/shared";

/** Etiqueta corta de una cubeta según el rango — mismo criterio de
 * `format-date.ts` (es-MX, hora de Ciudad de México, nunca la hora del
 * navegador). */
function formatBucketLabel(range: OverviewRange, iso: string): string {
  const date = new Date(iso);
  const timeZone = "America/Mexico_City";
  if (range === OverviewRange.DAY) {
    return date.toLocaleTimeString("es-MX", { timeZone, hour: "2-digit", minute: "2-digit" });
  }
  if (range === OverviewRange.YEAR) {
    return date.toLocaleDateString("es-MX", { timeZone, month: "short", year: "2-digit" });
  }
  return date.toLocaleDateString("es-MX", { timeZone, day: "numeric", month: "short" });
}

export { formatBucketLabel };
