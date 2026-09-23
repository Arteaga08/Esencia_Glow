/**
 * Única fuente de la URL del API (FRONTEND_GUIDELINES.md §4) — nunca
 * `const API = ...` disperso por archivo. Fail-fast si falta, mismo criterio
 * que `loadEnv()` en apps/api: mejor un crash claro al arrancar que un
 * `fetch` silencioso a `undefined`.
 */
function readApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_API_URL no está configurada. Ver apps/web/.env.example.",
    );
  }
  return raw.replace(/\/$/, "");
}

const API_URL = readApiUrl();

export { API_URL };
