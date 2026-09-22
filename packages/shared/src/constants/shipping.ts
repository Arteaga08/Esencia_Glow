/**
 * Política de generación de guías (Milestone 1.9). Ver `ShippingLabelStatus`.
 */

/** Rechazos explícitos reintentados antes de mandar la guía a revisión. */
const LABEL_MAX_ATTEMPTS = 5;

/** Backoff exponencial entre reintentos: base * 2^(intento-1) minutos. */
const LABEL_BACKOFF_BASE_MINUTES = 5;

/** Deadline duro de la llamada de compra. Vencerlo NO es un fallo seguro de
 * reintentar: el proveedor pudo haber cobrado — se manda a revisión. */
const LABEL_PURCHASE_TIMEOUT_MS = 30_000;

/** Un `requested` más viejo que esto significa que el proceso murió a media
 * compra: se manda a revisión, nunca se recompra. Mayor que
 * `LABEL_PURCHASE_TIMEOUT_MS` con holgura. */
const LABEL_REQUEST_LEASE_MINUTES = 10;

/** Una guía `processing` (ya cobrada) que no termina de generarse en este
 * plazo se manda a revisión en vez de quedarse esperando en silencio. */
const LABEL_PROCESSING_MAX_HOURS = 6;

export {
  LABEL_MAX_ATTEMPTS,
  LABEL_BACKOFF_BASE_MINUTES,
  LABEL_PURCHASE_TIMEOUT_MS,
  LABEL_REQUEST_LEASE_MINUTES,
  LABEL_PROCESSING_MAX_HOURS,
};
