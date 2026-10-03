import {
  HOME_CONTENT_LIMITS,
  type AdminHomeSpotlight,
} from "@esencia-glow/shared";
import type { HeroImageDraft, HeroImageSlot } from "./hero-form-value";

/** Los dos bloques con portada del home (bloque 5): clave de sección, ruta del API y textos de ayuda. */
interface SpotlightMeta {
  section: "newArrivals" | "kits";
  /** Segmento de `/admin/home/spotlights/:slug`. */
  slug: "new-arrivals" | "kits";
  label: string;
  defaultTitle: string;
  titlePlaceholder: string;
  subtitlePlaceholder: string;
  cardsHint: string;
}

const NEW_ARRIVALS_META: SpotlightMeta = {
  section: "newArrivals",
  slug: "new-arrivals",
  label: "Novedades del home",
  defaultTitle: "Novedades",
  titlePlaceholder: "Novedades",
  subtitlePlaceholder: "Lo último que llegó a nuestro estante",
  cardsHint: `Las ${HOME_CONTENT_LIMITS.maxNewArrivals} tarjetas son los productos marcados como Novedad (máximo ${HOME_CONTENT_LIMITS.maxNewArrivals}). Se marcan desde el editor de cada producto.`,
};

const KITS_META: SpotlightMeta = {
  section: "kits",
  slug: "kits",
  label: "Kits del home",
  defaultTitle: "Kits",
  titlePlaceholder: "Kits",
  subtitlePlaceholder: "Rutinas completas a mejor precio",
  cardsHint: "Las 4 tarjetas son los kits publicados más recientes.",
};

interface SpotlightFormValue {
  isActive: boolean;
  title: string;
  subtitle: string;
  images: Record<HeroImageSlot, HeroImageDraft>;
}

/** Una sección nunca escrita llega sin título: se precarga el del bloque para no empezar en blanco. */
function toFormValue(section: AdminHomeSpotlight, meta: SpotlightMeta): SpotlightFormValue {
  return {
    isActive: section.isActive,
    title: section.title || meta.defaultTitle,
    subtitle: section.subtitle ?? "",
    images: {
      desktop: { existing: section.images.desktop, removed: false },
      mobile: { existing: section.images.mobile, removed: false },
    },
  };
}

/** Cuerpo del `PUT /admin/home/spotlights/:slug`: un subtítulo vacío se omite (= quitarlo). */
function toPayload(value: SpotlightFormValue, version: number) {
  return {
    version,
    isActive: value.isActive,
    title: value.title.trim(),
    ...(value.subtitle.trim() ? { subtitle: value.subtitle.trim() } : {}),
  };
}

/** Errores de formato con las mismas reglas que el servidor, para no ir a un 400 evitable. */
function validate(value: SpotlightFormValue): Record<string, string> {
  const errors: Record<string, string> = {};
  const limits = HOME_CONTENT_LIMITS;
  if (!value.title.trim()) errors.title = "Escribe el título del bloque.";
  else if (value.title.trim().length > limits.titleMax)
    errors.title = `Máximo ${limits.titleMax} caracteres.`;
  if (value.subtitle.trim().length > limits.subtitleMax)
    errors.subtitle = `Máximo ${limits.subtitleMax} caracteres.`;
  return errors;
}

function hasDesktopImage(value: SpotlightFormValue): boolean {
  const { existing, file, removed } = value.images.desktop;
  return Boolean(file) || (Boolean(existing) && !removed);
}

/** Huella de lo mostrado: sirve para saber si hay cambios sin guardar. */
function fingerprint(value: SpotlightFormValue): string {
  return JSON.stringify({
    isActive: value.isActive,
    title: value.title,
    subtitle: value.subtitle,
    images: (["desktop", "mobile"] as const).map((slot) => ({
      file: value.images[slot].file
        ? `${value.images[slot].file!.name}:${value.images[slot].file!.size}`
        : null,
      removed: value.images[slot].removed,
    })),
  });
}

export { NEW_ARRIVALS_META, KITS_META, toFormValue, toPayload, validate, hasDesktopImage, fingerprint };
export type { SpotlightMeta, SpotlightFormValue };
