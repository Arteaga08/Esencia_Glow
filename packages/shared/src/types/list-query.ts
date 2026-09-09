/**
 * Forma normalizada de los query params de cualquier listado administrativo.
 * La produce `parseListQuery` en la API y la consume el dashboard para tipar sus filtros.
 */

type SortDirection = "asc" | "desc";

interface ListSort {
  field: string;
  direction: SortDirection;
}

interface ListQuery {
  page: number;
  limit: number;
  sort: ListSort;
  search: string | undefined;
}

export type { SortDirection, ListSort, ListQuery };
