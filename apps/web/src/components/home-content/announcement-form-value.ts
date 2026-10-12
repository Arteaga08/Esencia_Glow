import { HOME_CONTENT_LIMITS, type AdminHomeAnnouncement } from "@esencia-glow/shared";
import { HREF_PATTERN } from "./hero-form-value";

interface AnnouncementFormValue {
  isActive: boolean;
  text: string;
  href: string;
}

function toFormValue(section: AdminHomeAnnouncement): AnnouncementFormValue {
  return { isActive: section.isActive, text: section.text, href: section.href ?? "" };
}

/** Cuerpo del `PUT /admin/home/announcement`; sin enlace, `href` no viaja y el aviso queda sin link. */
function toPayload(value: AnnouncementFormValue, version: number) {
  const href = value.href.trim();
  return {
    version,
    isActive: value.isActive,
    text: value.text.trim(),
    ...(href ? { href } : {}),
  };
}

/** Errores de formato con las mismas reglas que el servidor, para no ir a un 400 evitable. */
function validate(value: AnnouncementFormValue): Record<string, string> {
  const errors: Record<string, string> = {};
  const limits = HOME_CONTENT_LIMITS;
  const text = value.text.trim();
  const href = value.href.trim();

  if (!text) errors.text = "Escribe la frase del aviso.";
  else if (text.length > limits.announcementTextMax) errors.text = `Máximo ${limits.announcementTextMax} caracteres.`;

  if (href && (href.length > limits.hrefMax || !HREF_PATTERN.test(href))) {
    errors.href = "Usa una ruta de la tienda (/ofertas) o una dirección que empiece con https://.";
  }

  return errors;
}

/** Huella de lo mostrado: sirve para saber si hay cambios sin guardar. */
function fingerprint(value: AnnouncementFormValue): string {
  return JSON.stringify({ isActive: value.isActive, text: value.text, href: value.href });
}

export { toFormValue, toPayload, validate, fingerprint };
export type { AnnouncementFormValue };
