/**
 * Destino de `?redirect=` tras ingresar. Es el control anti open-redirect:
 * solo se acepta una ruta del MISMO sitio. Todo lo demás cae en
 * `DEFAULT_REDIRECT`, sin error (quien llega con un enlace raro simplemente
 * entra a Mi cuenta).
 */
const DEFAULT_REDIRECT = "/mi-cuenta";

// Origen ficticio: sirve para que `new URL` resuelva y normalice la ruta (quita
// `..`, decodifica el host) y comprobar que NO cambió de origen.
const FAKE_ORIGIN = "http://redirect.invalid";
const MAX_LENGTH = 512;

// El panel tiene su propio login y las pantallas de acceso no son un destino
// (mandar a quien acaba de ingresar de vuelta a /ingresar cierra un ciclo).
const BLOCKED_PREFIXES = ["/admin", "/ingresar", "/crear-cuenta", "/verificar-correo", "/recuperar-contrasena", "/restablecer-contrasena"];

// Caracteres de control (el parser de URL los ignora y `/\t/evil.com` se vuelve
// `//evil.com`) y `\` (los navegadores lo tratan como `/`).
function hasForbiddenChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f || code === 0x5c) return true;
  }
  return false;
}

function isBlocked(pathname: string): boolean {
  return BLOCKED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function resolveRedirect(raw: string | string[] | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_LENGTH) return DEFAULT_REDIRECT;
  if (hasForbiddenChars(raw)) return DEFAULT_REDIRECT;
  // Una sola barra inicial: `//host` es una URL "protocol-relative".
  if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_REDIRECT;

  let url: URL;
  try {
    url = new URL(raw, FAKE_ORIGIN);
  } catch {
    return DEFAULT_REDIRECT;
  }
  if (url.origin !== FAKE_ORIGIN) return DEFAULT_REDIRECT;
  // La ruta ya normalizada: `/mi-cuenta/../admin` se evalúa (y se devuelve) como `/admin`.
  if (url.pathname.startsWith("//") || isBlocked(url.pathname)) return DEFAULT_REDIRECT;

  return `${url.pathname}${url.search}${url.hash}`;
}

export { DEFAULT_REDIRECT, resolveRedirect };
