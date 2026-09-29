import type { CommerceSettings } from "@esencia-glow/shared";
import { centsToPesosInput, pesosInputToCents } from "@/lib/format-money";

/**
 * Valor de formulario de la sección Comercio (Milestone 2.8): todo en texto
 * de pantalla, nunca en el tipo de la API — mismo criterio que
 * `PlanFormValue`. `taxRatePct` es el IVA como porcentaje (16, no 1600):
 * convertirlo a `taxRateBps` es responsabilidad de `commerceFormToPatch`,
 * nunca del campo.
 */
interface CommerceFormValue {
  taxRatePct: string;
  freeShippingThresholdPesos: string;
  shippingQuoteTtlMinutes: string;
}

function commerceToFormValue(settings: CommerceSettings): CommerceFormValue {
  return {
    taxRatePct: (settings.taxRateBps / 100).toString(),
    // 0 = desactivado (ver ShippingSettings): se muestra vacío, no "0.00",
    // para que el campo se lea como "sin umbral" en vez de "$0".
    freeShippingThresholdPesos:
      settings.freeShippingThresholdCents === 0
        ? ""
        : centsToPesosInput(settings.freeShippingThresholdCents),
    shippingQuoteTtlMinutes: settings.shippingQuoteTtlMinutes.toString(),
  };
}

/** `round(pct * 100)` evita que 16.1 * 100 deje un `1609.999999` que Joi
 * rechazaría por no-entero (mismo problema que resuelve `pesosInputToCents`
 * para dinero). `null` si el campo está vacío o no es un número. */
function taxPctToBps(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const pct = Number(trimmed);
  if (Number.isNaN(pct)) return null;
  return Math.round(pct * 100);
}

function minutesToInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const minutes = Number(trimmed);
  if (Number.isNaN(minutes) || !Number.isInteger(minutes)) return null;
  return minutes;
}

/** Diff contra lo guardado: solo las claves que de verdad cambiaron viajan
 * en el PATCH (`updateCommerceSettingsSchema` exige mínimo 1, pero nunca
 * hay que mandar las que no se tocaron). El mismo resultado sirve para
 * calcular `dirty` (`Object.keys(patch).length > 0`). */
function commerceFormToPatch(
  value: CommerceFormValue,
  saved: CommerceSettings,
): Partial<CommerceSettings> {
  const patch: Partial<CommerceSettings> = {};

  const taxRateBps = taxPctToBps(value.taxRatePct);
  if (taxRateBps !== null && taxRateBps !== saved.taxRateBps) {
    patch.taxRateBps = taxRateBps;
  }

  const freeShippingThresholdCents =
    value.freeShippingThresholdPesos.trim() === ""
      ? 0
      : (pesosInputToCents(value.freeShippingThresholdPesos) ?? saved.freeShippingThresholdCents);
  if (freeShippingThresholdCents !== saved.freeShippingThresholdCents) {
    patch.freeShippingThresholdCents = freeShippingThresholdCents;
  }

  const shippingQuoteTtlMinutes = minutesToInt(value.shippingQuoteTtlMinutes);
  if (shippingQuoteTtlMinutes !== null && shippingQuoteTtlMinutes !== saved.shippingQuoteTtlMinutes) {
    patch.shippingQuoteTtlMinutes = shippingQuoteTtlMinutes;
  }

  return patch;
}

/**
 * Regla cruzada del backend (`settings.service.ts::assertShippingQuoteTtl`),
 * validada aquí en lenguaje humano para no dejar que el mensaje del servidor
 * ("El TTL de la cotización...") llegue a la pantalla. Solo se evalúa cuando
 * el campo de cotización tiene un valor entero válido — los demás errores de
 * forma (vacío, no entero) los cubre `commerceFieldFormatErrors`.
 */
function shippingQuoteTtlError(
  value: CommerceFormValue,
  reservationTtlMinutes: number,
): string | null {
  const minutes = minutesToInt(value.shippingQuoteTtlMinutes);
  if (minutes === null) return null;
  if (minutes <= reservationTtlMinutes) {
    return `Debe durar más que los ${reservationTtlMinutes} min que dura un apartado de stock.`;
  }
  return null;
}

/**
 * Errores de forma de "IVA" y "Vigencia": a diferencia de
 * `freeShippingThresholdPesos` (donde vacío es un valor válido, "desactivado"),
 * un IVA o una vigencia vacíos o no numéricos no tienen lectura de negocio —
 * `commerceFormToPatch` los omitiría en silencio del PATCH, así que hay que
 * detectarlos aquí y bloquear el guardado, no solo dejar que el campo se
 * revierta sin aviso al valor guardado (hallazgo de code review, Milestone
 * 2.8). Solo se computan campo por campo: no dependen del valor guardado.
 */
function commerceFieldFormatErrors(value: CommerceFormValue): Partial<Record<keyof CommerceFormValue, string>> {
  const errors: Partial<Record<keyof CommerceFormValue, string>> = {};

  const taxTrimmed = value.taxRatePct.trim();
  if (taxTrimmed === "") errors.taxRatePct = "Ingresa el IVA.";
  else if (Number.isNaN(Number(taxTrimmed))) errors.taxRatePct = "Ingresa un porcentaje válido.";

  const ttlTrimmed = value.shippingQuoteTtlMinutes.trim();
  if (ttlTrimmed === "") errors.shippingQuoteTtlMinutes = "Ingresa la vigencia.";
  else if (minutesToInt(value.shippingQuoteTtlMinutes) === null)
    errors.shippingQuoteTtlMinutes = "Ingresa un número entero de minutos.";

  return errors;
}

export type { CommerceFormValue };
export { commerceToFormValue, commerceFormToPatch, shippingQuoteTtlError, commerceFieldFormatErrors };
