import { createHash, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";

/**
 * Identidad del cliente para los rate limiters.
 *
 * El servidor de Next (apps/web) llama a la API como un único cliente: sin
 * ayuda, todo el tráfico renderizado en el servidor comparte una sola IP y una
 * sola cubeta. Con `INTERNAL_API_TOKEN` el servidor web demuestra quién es y
 * puede "prestar" la IP real del visitante en `x-client-ip`. Sin el token ese
 * header es solo un dato más que cualquiera puede inventar, así que se ignora.
 *
 * Las funciones reciben el token configurado (en vez de leer `env`) para que
 * `undefined` signifique siempre "no hay token: no se confía en nadie".
 */

/** Prefijo IPv6 que comparte una llave: un /56 es lo que un ISP entrega a un hogar. */
const IPV6_KEY_PREFIX = 56;

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function headerValue(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return typeof value === "string" ? value : undefined;
}

/** Comparación en tiempo constante (sobre hashes, así la longitud tampoco se filtra). */
function hasValidInternalToken(req: Request, configuredToken: string | undefined): boolean {
  if (!configuredToken) return false;
  const received = headerValue(req, "x-internal-token");
  if (!received) return false;
  return timingSafeEqual(digest(received), digest(configuredToken));
}

/** IP del visitante reenviada por el servidor web, o `req.ip` si no hay forma de confiar en ella. */
function resolveClientIp(req: Request, configuredToken: string | undefined): string {
  if (hasValidInternalToken(req, configuredToken)) {
    const forwarded = headerValue(req, "x-client-ip");
    if (forwarded && isIP(forwarded) !== 0) return forwarded;
  }
  return req.ip ?? "unknown";
}

/** Llave de rate limit por IP: IPv4 tal cual, IPv6 agrupada por /56. */
function clientIpKey(req: Request, configuredToken: string | undefined): string {
  return ipKeyGenerator(resolveClientIp(req, configuredToken), IPV6_KEY_PREFIX);
}

/**
 * Petición del servidor web SIN visitante detrás (revalidación de caché de Next,
 * datos iguales para todos): no debe gastar la cuota de nadie. Si trae
 * `x-client-ip`, en cambio, hay un visitante y se cuenta por su IP.
 */
function isTrustedServerRequest(req: Request, configuredToken: string | undefined): boolean {
  return hasValidInternalToken(req, configuredToken) && headerValue(req, "x-client-ip") === undefined;
}

export { hasValidInternalToken, resolveClientIp, clientIpKey, isTrustedServerRequest };
