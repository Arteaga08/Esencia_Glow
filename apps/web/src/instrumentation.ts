/**
 * Se ejecuta una vez al arrancar el servidor de Next. Fail-fast de las
 * variables de servidor (ver `lib/server-env.ts`); no corre en `next build`,
 * donde no existen los secretos de runtime. El import es dinámico y solo en
 * Node: este archivo también se compila para Edge, que no tiene `node:net`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { findServerEnvProblems } = await import("./lib/server-env");
  const problems = findServerEnvProblems(process.env);
  if (problems.length > 0) {
    throw new Error(`Configuración del servidor web inválida. ${problems.join(" ")} Ver apps/web/.env.example.`);
  }
}
