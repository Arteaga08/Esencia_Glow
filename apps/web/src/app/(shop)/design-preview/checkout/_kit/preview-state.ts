import { PREVIEW_VIEWS, type PreviewView } from "./preview-types";

type SearchParams = Record<string, string | string[] | undefined>;

interface PreviewState {
  view: PreviewView;
  /** Estado alternativo de la vista (`?estado=`), o `null` para la vista base. */
  state: string | null;
}

function first(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? raw : null;
}

/** Lee `?vista=` y `?estado=`; una vista desconocida cae al carrito. */
function readPreviewState(params: SearchParams, fallback: PreviewView = "carrito"): PreviewState {
  const view = first(params.vista);
  const known = PREVIEW_VIEWS.find((candidate) => candidate === view);
  return { view: known ?? fallback, state: first(params.estado) };
}

/** Enlace a otra vista de la misma propuesta (los botones "Continuar" lo usan). */
function previewHref(base: string, view: PreviewView, state?: string): string {
  const query = new URLSearchParams({ vista: view });
  if (state) query.set("estado", state);
  return `${base}?${query.toString()}`;
}

export { readPreviewState, previewHref };
export type { PreviewState, SearchParams };
