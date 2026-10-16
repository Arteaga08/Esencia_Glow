import { isIP } from "node:net";

/**
 * IP real del visitante a partir de `x-forwarded-for`, con la misma regla que
 * `trust proxy = N` de Express en el API: se confía en los últimos N saltos y la
 * entrada justo antes de ellos es el cliente. Todo lo que el visitante haya
 * escrito a la izquierda en la cabecera se ignora.
 *
 * `null` cuando no se puede saber con certeza (sin saltos de confianza, cadena
 * más corta que los saltos, valor que no es una IP): quien llama decide el
 * respaldo, nunca se inventa una IP.
 */
function pickVisitorIp(forwardedFor: string | null | undefined, trustedHops: number): string | null {
  if (!forwardedFor || trustedHops < 1) return null;
  const chain = forwardedFor.split(",").map((entry) => entry.trim());
  if (chain.length < trustedHops) return null;
  const candidate = chain[chain.length - trustedHops];
  return candidate && isIP(candidate) !== 0 ? candidate : null;
}

/** `TRUST_PROXY_HOPS` del servidor web: entero no negativo, o `null` si falta o es inválido. */
function parseTrustedHops(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim().length === 0) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export { pickVisitorIp, parseTrustedHops };
