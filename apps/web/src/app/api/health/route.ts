/**
 * Liveness del servidor web para el healthcheck de Railway. No llama al API a
 * propósito: si el API se está reiniciando, el web sigue sano y no se reinicia
 * en cadena. Siempre dinámico para que nunca se sirva una respuesta cacheada.
 *
 * `dynamic` va exportado inline (no al final como el resto del repo): Next lo
 * lee estáticamente al compilar y rechaza `export { dynamic }`.
 */
export const dynamic = "force-dynamic";

async function GET() {
  return Response.json({ status: "ok" });
}

export { GET };
