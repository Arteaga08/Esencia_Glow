import { parseTrustedHops } from "./visitor-ip";

/** Mismo mínimo que `INTERNAL_API_TOKEN` en el API (apps/api/src/config/env.ts). */
const MIN_INTERNAL_TOKEN_LENGTH = 32;

/**
 * Variables de SERVIDOR que el web necesita en producción para que el API
 * cuente las peticiones por visitante y no por el servidor (auditoría run-2,
 * hallazgo 1). Se revisa al arrancar (`instrumentation.ts`): mejor un crash
 * claro que un sitio que "funciona" pero comparte una sola cuota entre todos.
 */
function findServerEnvProblems(env: Record<string, string | undefined>): string[] {
  if (env.NODE_ENV !== "production") return [];
  const problems: string[] = [];
  if (!env.INTERNAL_API_TOKEN || env.INTERNAL_API_TOKEN.length < MIN_INTERNAL_TOKEN_LENGTH) {
    problems.push(`INTERNAL_API_TOKEN falta o tiene menos de ${MIN_INTERNAL_TOKEN_LENGTH} caracteres.`);
  }
  // Con 0 saltos el servidor no puede saber la IP del visitante y todo volvería a contarse
  // por la IP del servidor web: en producción siempre hay al menos un proxy delante.
  const hops = parseTrustedHops(env.TRUST_PROXY_HOPS);
  if (hops === null || hops < 1) {
    problems.push("TRUST_PROXY_HOPS falta o no es un entero mayor o igual a 1.");
  }
  return problems;
}

export { findServerEnvProblems, MIN_INTERNAL_TOKEN_LENGTH };
