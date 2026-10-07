import { useEffect, useState } from "react";
import type { AdminCustomerListItem, AdminOrder, PaginationMeta } from "@esencia-glow/shared";
import { apiRequest } from "@/lib/api";
import type { AdminProduct } from "@/lib/types/admin-catalog";
import { mergeOrders } from "./merge-orders";

/** Con menos letras que esto no se busca: una sola coincide con casi todo. */
const GLOBAL_SEARCH_MIN_LENGTH = 2;
const RESULTS_PER_GROUP = 4;

interface SearchGroup<T> {
  items: T[];
  /** `true` si ese grupo no pudo cargar; los otros se muestran igual. */
  failed: boolean;
}

interface GlobalSearchResults {
  orders: SearchGroup<AdminOrder>;
  customers: SearchGroup<AdminCustomerListItem>;
  products: SearchGroup<AdminProduct>;
}

interface SearchState {
  term: string;
  results: GlobalSearchResults;
}

const EMPTY: GlobalSearchResults = {
  orders: { items: [], failed: false },
  customers: { items: [], failed: false },
  products: { items: [], failed: false },
};

function listOf<T>(path: string, query: Record<string, string | number>): Promise<T[]> {
  return apiRequest<T[], PaginationMeta>(path, { authenticated: true, query: { ...query, page: 1, limit: RESULTS_PER_GROUP } }).then(
    (response) => response.data,
  );
}

function toGroup<T>(result: PromiseSettledResult<T[]>): SearchGroup<T> {
  return result.status === "fulfilled" ? { items: result.value, failed: false } : { items: [], failed: true };
}

async function runSearch(term: string): Promise<GlobalSearchResults> {
  const [byNumber, byText, customers, products] = await Promise.allSettled([
    listOf<AdminOrder>("/api/v1/admin/orders", { orderNumber: term }),
    listOf<AdminOrder>("/api/v1/admin/orders", { search: term }),
    listOf<AdminCustomerListItem>("/api/v1/admin/customers", { search: term }),
    listOf<AdminProduct>("/api/v1/admin/products", { search: term }),
  ]);

  // El pedido solo "falla" si fallaron las dos consultas; con una basta.
  const ordersFailed = byNumber.status === "rejected" && byText.status === "rejected";
  const orders = mergeOrders(
    byNumber.status === "fulfilled" ? byNumber.value : [],
    byText.status === "fulfilled" ? byText.value : [],
    RESULTS_PER_GROUP,
  );

  return {
    orders: { items: orders, failed: ordersFailed },
    customers: toGroup(customers),
    products: toGroup(products),
  };
}

/**
 * Busca en pedidos, clientes y productos a la vez. Recibe el texto ya
 * estabilizado (debounce) y normalizado: `""` significa "no busques". Descarta
 * las respuestas de un texto anterior; mientras llega la nueva `loading` es
 * `true` y los resultados previos no se muestran como si fueran de este texto.
 */
function useGlobalSearch(term: string): { results: GlobalSearchResults; loading: boolean } {
  const [state, setState] = useState<SearchState | null>(null);
  const active = term.length >= GLOBAL_SEARCH_MIN_LENGTH;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    runSearch(term).then((results) => {
      if (!cancelled) setState({ term, results });
    });
    return () => {
      cancelled = true;
    };
  }, [term, active]);

  if (!active) return { results: EMPTY, loading: false };
  if (state?.term !== term) return { results: EMPTY, loading: true };
  return { results: state.results, loading: false };
}

export { useGlobalSearch, GLOBAL_SEARCH_MIN_LENGTH };
export type { GlobalSearchResults, SearchGroup };
