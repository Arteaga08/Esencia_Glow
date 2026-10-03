import { HOME_CONTENT_LIMITS, type AdminHomeOfferBanner } from "@esencia-glow/shared";
import { HREF_PATTERN, type HeroImageDraft, type HeroImageSlot } from "./hero-form-value";

interface OfferBannerFormValue {
  isActive: boolean;
  text: string;
  ctaLabel: string;
  ctaHref: string;
  images: Record<HeroImageSlot, HeroImageDraft>;
}

function toFormValue(section: AdminHomeOfferBanner): OfferBannerFormValue {
  return {
    isActive: section.isActive,
    text: section.text,
    ctaLabel: section.ctaLabel,
    ctaHref: section.ctaHref,
    images: {
      desktop: { existing: section.images.desktop, removed: false },
      mobile: { existing: section.images.mobile, removed: false },
    },
  };
}

/** Cuerpo del `PUT /admin/home/offer-banner`. */
function toPayload(value: OfferBannerFormValue, version: number) {
  return {
    version,
    isActive: value.isActive,
    text: value.text.trim(),
    ctaLabel: value.ctaLabel.trim(),
    ctaHref: value.ctaHref.trim(),
  };
}

/** Errores de formato con las mismas reglas que el servidor, para no ir a un 400 evitable. */
function validate(value: OfferBannerFormValue): Record<string, string> {
  const errors: Record<string, string> = {};
  const limits = HOME_CONTENT_LIMITS;
  const text = value.text.trim();
  const ctaLabel = value.ctaLabel.trim();
  const href = value.ctaHref.trim();

  if (!text) errors.text = "Escribe la frase que corre sobre la foto.";
  else if (text.length > limits.offerTextMax) errors.text = `Máximo ${limits.offerTextMax} caracteres.`;

  if (!ctaLabel) errors.ctaLabel = "Escribe el texto del botón.";
  else if (ctaLabel.length > limits.ctaLabelMax) errors.ctaLabel = `Máximo ${limits.ctaLabelMax} caracteres.`;

  if (!href) errors.ctaHref = "Elige el producto al que lleva el botón.";
  else if (!HREF_PATTERN.test(href) || href.length > limits.hrefMax)
    errors.ctaHref = "Ese enlace no es válido. Elige un producto para reemplazarlo.";

  return errors;
}

function hasDesktopImage(value: OfferBannerFormValue): boolean {
  const { existing, file, removed } = value.images.desktop;
  return Boolean(file) || (Boolean(existing) && !removed);
}

/** Huella de lo mostrado: sirve para saber si hay cambios sin guardar. */
function fingerprint(value: OfferBannerFormValue): string {
  return JSON.stringify({
    isActive: value.isActive,
    text: value.text,
    ctaLabel: value.ctaLabel,
    ctaHref: value.ctaHref,
    images: (["desktop", "mobile"] as const).map((slot) => ({
      file: value.images[slot].file
        ? `${value.images[slot].file!.name}:${value.images[slot].file!.size}`
        : null,
      removed: value.images[slot].removed,
    })),
  });
}

export { toFormValue, toPayload, validate, hasDesktopImage, fingerprint };
export type { OfferBannerFormValue };
