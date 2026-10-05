import type { NextRequest } from "next/server";
import { getSuggestions } from "@/lib/storefront/suggestions";

const MAX_VALUES = 5;
const MAX_VALUE_LENGTH = 80;

function readList(value: string | null): string[] {
  if (!value || value.length > MAX_VALUES * (MAX_VALUE_LENGTH + 1)) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && entry.length <= MAX_VALUE_LENGTH)
    .slice(0, MAX_VALUES);
}

/**
 * Sugerencias para el bloque "Sugeridos para ti". El navegador manda las
 * categorías y marcas que más ha visto la clienta (`?categorias=a,b&marcas=X,Y`)
 * y aquí, en el servidor, se piden los productos al API: así el navegador no
 * necesita permiso de CORS ni conoce la dirección del API. Entrada acotada
 * aquí y validada contra el catálogo real en `getSuggestions`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const payload = await getSuggestions({
    categories: readList(searchParams.get("categorias")).map((slug) => slug.toLowerCase()),
    brands: readList(searchParams.get("marcas")),
  });
  // Depende del historial de cada clienta: que la guarde su navegador, no un caché compartido.
  return Response.json(payload, { headers: { "Cache-Control": "private, max-age=60" } });
}
