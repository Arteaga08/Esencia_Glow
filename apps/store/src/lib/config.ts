/**
 * Única fuente de la URL del API — nunca `const API = ...` disperso por
 * archivo. Fail-fast si falta, mismo criterio que `loadEnv()` en apps/api.
 */
function readApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) {
    throw new Error("NEXT_PUBLIC_API_URL no está configurada. Ver apps/store/.env.example.");
  }
  return raw.replace(/\/$/, "");
}

const API_URL = readApiUrl();

export { API_URL };
