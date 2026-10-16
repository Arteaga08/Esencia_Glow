/**
 * Cómo leer la respuesta del API desde el servidor de Next. Existe para que un
 * 429 (límite de peticiones) o un 5xx NUNCA se interprete como "sin sesión":
 * eso sacaba a la admin al login y a la clienta de su cuenta cada vez que el
 * API estaba saturado.
 */
type UpstreamOutcome = "ok" | "unauthorized" | "rate-limited" | "unavailable";

function classifyUpstreamStatus(status: number): UpstreamOutcome {
  if (status >= 200 && status < 300) return "ok";
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate-limited";
  return "unavailable";
}

export { classifyUpstreamStatus };
export type { UpstreamOutcome };
