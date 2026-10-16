import "server-only";
import { headers } from "next/headers";
import { MIN_INTERNAL_TOKEN_LENGTH } from "./server-env";
import { parseTrustedHops, pickVisitorIp } from "./visitor-ip";

/**
 * Identidad del servidor de Next ante el API (auditoría de seguridad run-2,
 * hallazgo 1). Todas las llamadas del servidor web salen desde una sola IP:
 * sin ayuda, el API las cuenta como UN cliente y una sola persona puede agotar
 * la cuota de todas. Con `INTERNAL_API_TOKEN` (secreto compartido con el API)
 * el servidor demuestra quién es y, cuando hay un visitante detrás, le presta
 * su IP en `x-client-ip` para que el API cuente por visitante.
 *
 * Son variables de SERVIDOR: jamás `NEXT_PUBLIC_*` (llegarían al navegador).
 */

/**
 * Sin token (dev, o `next build`) simplemente no se mandan cabeceras. En
 * producción la falta se detecta al arrancar (`instrumentation.ts`), no aquí:
 * estas llamadas viven dentro de `try/catch` que se tragarían el error.
 */
function readInternalToken(): string | null {
  const token = process.env.INTERNAL_API_TOKEN;
  return token && token.length >= MIN_INTERNAL_TOKEN_LENGTH ? token : null;
}

async function readVisitorIp(): Promise<string | null> {
  const hops = parseTrustedHops(process.env.TRUST_PROXY_HOPS) ?? 0;
  return pickVisitorIp((await headers()).get("x-forwarded-for"), hops);
}

interface InternalHeadersOptions {
  /**
   * `true` cuando la llamada nace de lo que hace un visitante concreto (sesión,
   * búsqueda, filtros): lleva su IP y el API la cuenta como suya. Esto vuelve
   * dinámica la página (lee `headers()`), así que NO se usa en datos cacheados
   * iguales para todos. `false` (por defecto): solo el token, y el API cuenta la
   * llamada en la cubeta propia del servidor web.
   */
  visitor?: boolean;
}

/**
 * Cabeceras de identidad para un `fetch` al API. Con `visitor: true` y sin
 * poder resolver la IP del visitante NO se manda el token: la llamada se cuenta
 * como antes (por la IP del servidor web) en vez de caer en la cubeta sin
 * visitante, que es más holgada.
 */
async function internalApiHeaders({ visitor = false }: InternalHeadersOptions = {}): Promise<Record<string, string>> {
  const token = readInternalToken();
  if (!token) return {};
  if (!visitor) return { "x-internal-token": token };

  const ip = await readVisitorIp();
  return ip ? { "x-internal-token": token, "x-client-ip": ip } : {};
}

export { internalApiHeaders };
