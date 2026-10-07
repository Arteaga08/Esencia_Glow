import type { NextRequest } from "next/server";
import { searchProducts } from "@/lib/storefront/search";
import { SEARCH_MAX_LENGTH } from "@/lib/storefront/search-term";

/**
 * Buscador del header. El navegador manda el texto (`?q=sérum`) y aquí, en el
 * servidor, se piden los productos al API: así el navegador no necesita
 * permiso de CORS ni conoce la dirección del API. Sin `q` responde los
 * productos que se muestran al abrir. El texto se acota aquí y se normaliza
 * en `searchProducts`.
 */
export async function GET(request: NextRequest) {
  const term = (request.nextUrl.searchParams.get("q") ?? "").slice(0, SEARCH_MAX_LENGTH);
  const payload = await searchProducts(term);
  if (!payload) {
    return Response.json({ message: "No pudimos buscar en este momento." }, { status: 502 });
  }
  // No depende de quién busca: el navegador puede guardar la respuesta un minuto.
  return Response.json(payload, { headers: { "Cache-Control": "public, max-age=60" } });
}
