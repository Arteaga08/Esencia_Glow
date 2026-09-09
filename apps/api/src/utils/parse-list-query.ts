import type { ListQuery, PaginationMeta } from "@esencia-glow/shared";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

interface RawListQuery {
  page?: unknown;
  limit?: unknown;
  sort?: unknown;
  search?: unknown;
}

function toPositiveInt(value: unknown, fallback: number, max?: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  const int = Math.floor(parsed);
  return max ? Math.min(int, max) : int;
}

/**
 * Parsea los query params crudos de cualquier listado administrativo a una
 * forma normalizada. Cada service de listado lo consume en vez de reimplementar
 * skip/limit a mano — ver BACKEND_ARCHITECTURE_GUIDELINES.md
 * ("Listados administrativos").
 */
function parseListQuery(raw: RawListQuery, defaultSortField = "createdAt"): ListQuery {
  const page = toPositiveInt(raw.page, DEFAULT_PAGE);
  const limit = toPositiveInt(raw.limit, DEFAULT_LIMIT, MAX_LIMIT);

  const sortRaw = typeof raw.sort === "string" ? raw.sort : defaultSortField;
  const direction = sortRaw.startsWith("-") ? "desc" : "asc";
  const field = sortRaw.startsWith("-") ? sortRaw.slice(1) : sortRaw;

  const search = typeof raw.search === "string" && raw.search.trim().length > 0
    ? raw.search.trim()
    : undefined;

  return { page, limit, sort: { field, direction }, search };
}

function buildMeta(total: number, query: Pick<ListQuery, "page" | "limit">): PaginationMeta {
  return {
    total,
    page: query.page,
    limit: query.limit,
    pages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

/** Escapa metacaracteres de RegExp antes de usar texto de usuario en un $regex. */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { parseListQuery, buildMeta, escapeRegex };
