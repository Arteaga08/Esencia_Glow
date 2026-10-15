import { HOME_CONTENT_LIMITS, type AdminHomeAdvice } from "@esencia-glow/shared";
import type { HeroImageDraft } from "./hero-form-value";

interface AdviceFormValue {
  isActive: boolean;
  eyebrow: string;
  title: string;
  body: string;
  archWord: string;
  ctaLabel: string;
  image: HeroImageDraft;
}

function toFormValue(section: AdminHomeAdvice): AdviceFormValue {
  return {
    isActive: section.isActive,
    eyebrow: section.eyebrow ?? "",
    title: section.title,
    body: section.body,
    archWord: section.archWord ?? "",
    ctaLabel: section.ctaLabel,
    image: { existing: section.image, removed: false },
  };
}

/** Cuerpo del `PUT /admin/home/advice`. Los opcionales vacíos no viajan: el servidor los quita. */
function toPayload(value: AdviceFormValue, version: number) {
  const eyebrow = value.eyebrow.trim();
  const archWord = value.archWord.trim();
  return {
    version,
    isActive: value.isActive,
    title: value.title.trim(),
    body: value.body.trim(),
    ctaLabel: value.ctaLabel.trim(),
    ...(eyebrow ? { eyebrow } : {}),
    ...(archWord ? { archWord } : {}),
  };
}

/** Errores de formato con las mismas reglas que el servidor, para no ir a un 400 evitable. */
function validate(value: AdviceFormValue): Record<string, string> {
  const errors: Record<string, string> = {};
  const limits = HOME_CONTENT_LIMITS;
  const title = value.title.trim();
  const body = value.body.trim();
  const ctaLabel = value.ctaLabel.trim();

  if (value.eyebrow.trim().length > limits.adviceEyebrowMax)
    errors.eyebrow = `Máximo ${limits.adviceEyebrowMax} caracteres.`;

  if (!title) errors.title = "Escribe el título del bloque.";
  else if (title.length > limits.adviceTitleMax) errors.title = `Máximo ${limits.adviceTitleMax} caracteres.`;

  if (!body) errors.body = "Escribe el texto que explica la asesoría.";
  else if (body.length > limits.subtitleMax) errors.body = `Máximo ${limits.subtitleMax} caracteres.`;

  if (value.archWord.trim().length > limits.adviceWordMax)
    errors.archWord = `Máximo ${limits.adviceWordMax} caracteres: tiene que caber sobre la foto.`;

  if (!ctaLabel) errors.ctaLabel = "Escribe el texto del botón.";
  else if (ctaLabel.length > limits.ctaLabelMax) errors.ctaLabel = `Máximo ${limits.ctaLabelMax} caracteres.`;

  return errors;
}

function hasImage(value: AdviceFormValue): boolean {
  const { existing, file, removed } = value.image;
  return Boolean(file) || (Boolean(existing) && !removed);
}

/** Huella de lo mostrado: sirve para saber si hay cambios sin guardar. */
function fingerprint(value: AdviceFormValue): string {
  const { image, ...texts } = value;
  return JSON.stringify({
    ...texts,
    image: { file: image.file ? `${image.file.name}:${image.file.size}` : null, removed: image.removed },
  });
}

export { toFormValue, toPayload, validate, hasImage, fingerprint };
export type { AdviceFormValue };
