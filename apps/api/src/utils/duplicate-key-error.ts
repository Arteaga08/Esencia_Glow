/**
 * Detección de E11000 compartida (Fase 3 de 1.7.2a). Cada service con su
 * propia copia (`subscription-edition.service.ts`, `stock-reservation.service.ts`,
 * `payment-event.service.ts`) es deuda anotada, no una regresión: refactorizar
 * esos archivos ya mergeados está fuera del alcance de este diff.
 */
interface MongoDuplicateKeyError {
  code: number;
}

function isDuplicateKeyError(error: unknown): error is MongoDuplicateKeyError {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;
}

export { isDuplicateKeyError };
