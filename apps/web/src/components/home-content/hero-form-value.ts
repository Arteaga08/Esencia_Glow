import {
  HOME_CONTENT_LIMITS,
  type AdminHomeHero,
  type PublicProductImage,
} from "@esencia-glow/shared";

type HeroImageSlot = "desktop" | "mobile";

/** Estado de una de las dos fotos de un slide: la guardada, una nueva por subir o una marcada para borrar. */
interface HeroImageDraft {
  existing?: PublicProductImage;
  file?: File;
  removed: boolean;
}

interface HeroSlideDraft {
  /** Clave estable solo del cliente: los slides nuevos todavía no tienen id del servidor. */
  key: string;
  id?: string;
  title: string;
  subtitle: string;
  ctaHref: string;
  isActive: boolean;
  images: Record<HeroImageSlot, HeroImageDraft>;
}

interface HeroFormValue {
  isActive: boolean;
  slides: HeroSlideDraft[];
}

// Mismo patrón que `HREF_PATTERN` del validador del API: ruta interna o https://.
const HREF_PATTERN = /^(?:\/(?![/\\])[^\s\\]*|https:\/\/[^\s]+)$/;

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `slide-${keyCounter}`;
}

function emptySlide(): HeroSlideDraft {
  return {
    key: nextKey(),
    title: "",
    subtitle: "",
    ctaHref: "",
    isActive: true,
    images: { desktop: { removed: false }, mobile: { removed: false } },
  };
}

function toFormValue(hero: AdminHomeHero): HeroFormValue {
  return {
    isActive: hero.isActive,
    slides: hero.slides.map((slide) => ({
      key: nextKey(),
      id: slide.id,
      title: slide.title,
      subtitle: slide.subtitle ?? "",
      ctaHref: slide.ctaHref ?? "",
      isActive: slide.isActive,
      images: {
        desktop: { existing: slide.images.desktop, removed: false },
        mobile: { existing: slide.images.mobile, removed: false },
      },
    })),
  };
}

/** Cuerpo del `PUT /admin/home/hero`: un campo opcional vacío se omite (= quitarlo). */
function toPayload(value: HeroFormValue, version: number) {
  return {
    version,
    isActive: value.isActive,
    slides: value.slides.map((slide) => ({
      ...(slide.id ? { id: slide.id } : {}),
      title: slide.title.trim(),
      ...(slide.subtitle.trim() ? { subtitle: slide.subtitle.trim() } : {}),
      ctaHref: slide.ctaHref.trim(),
      isActive: slide.isActive,
    })),
  };
}

/** Errores de formato por slide, con las mismas reglas que el servidor para no ir a un 400 evitable. */
function validateSlide(slide: HeroSlideDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  const limits = HOME_CONTENT_LIMITS;
  if (!slide.title.trim()) errors.title = "Escribe el título del slide.";
  else if (slide.title.trim().length > limits.titleMax)
    errors.title = `Máximo ${limits.titleMax} caracteres.`;
  if (slide.subtitle.trim().length > limits.subtitleMax)
    errors.subtitle = `Máximo ${limits.subtitleMax} caracteres.`;
  const href = slide.ctaHref.trim();
  if (!href) errors.ctaHref = "Indica a dónde lleva el slide.";
  else if (href.length > limits.hrefMax || !HREF_PATTERN.test(href)) {
    errors.ctaHref = "Usa una ruta interna (/tienda) o una URL que empiece con https://.";
  }
  return errors;
}

function hasDesktopImage(slide: HeroSlideDraft): boolean {
  const { existing, file, removed } = slide.images.desktop;
  return Boolean(file) || (Boolean(existing) && !removed);
}

/** Huella de lo que el editor mostraría guardado: sirve para saber si hay cambios sin guardar. */
function fingerprint(value: HeroFormValue): string {
  return JSON.stringify({
    isActive: value.isActive,
    slides: value.slides.map((slide) => ({
      id: slide.id ?? null,
      title: slide.title,
      subtitle: slide.subtitle,
      ctaHref: slide.ctaHref,
      isActive: slide.isActive,
      images: (["desktop", "mobile"] as const).map((slot) => ({
        file: slide.images[slot].file
          ? `${slide.images[slot].file!.name}:${slide.images[slot].file!.size}`
          : null,
        removed: slide.images[slot].removed,
      })),
    })),
  });
}

export { emptySlide, toFormValue, toPayload, validateSlide, hasDesktopImage, fingerprint };
export type { HeroImageSlot, HeroImageDraft, HeroSlideDraft, HeroFormValue };
