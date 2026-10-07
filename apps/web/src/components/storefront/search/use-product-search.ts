"use client";

import { useEffect, useState } from "react";
import type { SearchPayload } from "@/lib/storefront/search-term";

interface SearchState {
  /** Texto al que corresponde `payload`; `null` antes de la primera respuesta. */
  term: string | null;
  payload: SearchPayload | null;
  failed: boolean;
}

/**
 * Pide los resultados del buscador para un texto ya normalizado ("" = los
 * productos de bienvenida). Cancela la petición anterior si el texto cambia,
 * y mientras llega la nueva conserva la lista previa para que no parpadee.
 */
function useProductSearch(term: string): { payload: SearchPayload | null; loading: boolean; failed: boolean } {
  const [state, setState] = useState<SearchState>({ term: null, payload: null, failed: false });

  useEffect(() => {
    const controller = new AbortController();
    const query = term ? `?q=${encodeURIComponent(term)}` : "";

    fetch(`/api/storefront/search${query}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<SearchPayload>) : null))
      .then((payload) => setState({ term, payload, failed: payload === null }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ term, payload: null, failed: true });
      });
    return () => controller.abort();
  }, [term]);

  const loading = state.term !== term;
  return { payload: state.payload, loading, failed: !loading && state.failed };
}

export { useProductSearch };
