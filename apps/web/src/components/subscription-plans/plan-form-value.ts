import { centsToPesosInput, pesosInputToCents } from "@/lib/format-money";
import type { AdminSubscriptionPlan } from "@/lib/types/admin-subscription";

type BillingMode = "monthly" | "monthly_and_annual";

/** Estado editable del formulario de plan — todo string, tal cual lo teclea
 * el operador; la conversión a centavos/enteros ocurre solo al enviar. */
interface PlanFormValue {
  name: string;
  shortDescription: string;
  description: string;
  billingMode: BillingMode;
  price: string;
  annualPrice: string;
  maxActiveSeats: string;
  sortOrder: string;
  /** Viñetas tal cual se teclean (pueden quedar filas vacías). */
  highlights: string[];
}

const EMPTY_PLAN_FORM: PlanFormValue = {
  name: "",
  shortDescription: "",
  description: "",
  billingMode: "monthly",
  price: "",
  annualPrice: "",
  maxActiveSeats: "",
  sortOrder: "0",
  highlights: [],
};

function planToFormValue(plan: AdminSubscriptionPlan): PlanFormValue {
  return {
    name: plan.name,
    shortDescription: plan.shortDescription ?? "",
    description: plan.description,
    billingMode: plan.annualPriceCents !== undefined ? "monthly_and_annual" : "monthly",
    price: centsToPesosInput(plan.priceCents),
    annualPrice: centsToPesosInput(plan.annualPriceCents),
    maxActiveSeats: String(plan.maxActiveSeats),
    sortOrder: String(plan.sortOrder),
    highlights: plan.highlights,
  };
}

/** Viñetas listas para enviar: recortadas y sin filas vacías. */
function cleanHighlights(highlights: string[]): string[] {
  return highlights.map((text) => text.trim()).filter((text) => text !== "");
}

function toInteger(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

/** Cuerpo de `POST /admin/subscription-plans`. Un número inválido viaja
 * como `NaN` → `null` en JSON a propósito: Joi lo rechaza y su mensaje
 * aparece pegado al campo, sin duplicar la validación aquí. */
function formValueToCreateBody(value: PlanFormValue): Record<string, unknown> {
  return {
    name: value.name,
    description: value.description,
    shortDescription: value.shortDescription,
    priceCents: pesosInputToCents(value.price),
    ...(value.billingMode === "monthly_and_annual"
      ? { annualPriceCents: pesosInputToCents(value.annualPrice) }
      : {}),
    maxActiveSeats: toInteger(value.maxActiveSeats),
    sortOrder: toInteger(value.sortOrder),
    ...(cleanHighlights(value.highlights).length > 0
      ? { highlights: cleanHighlights(value.highlights) }
      : {}),
  };
}

/** Cuerpo del `PATCH`: solo lo que cambió respecto al plan guardado — el
 * backend exige al menos un campo (`.min(1)`) y nunca acepta precios. Un
 * número requerido que se dejó vacío viaja como `null` (nunca `undefined`,
 * que `JSON.stringify` borraría dejando un `PATCH {}` mudo): Joi lo rechaza
 * y el error queda pegado a ese campo (hallazgo de code review de 2.7b-2). */
function formValueToPatchBody(
  value: PlanFormValue,
  plan: AdminSubscriptionPlan,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (value.name !== plan.name) body.name = value.name;
  if (value.description !== plan.description) body.description = value.description;
  if (value.shortDescription !== (plan.shortDescription ?? ""))
    body.shortDescription = value.shortDescription;
  const seats = toInteger(value.maxActiveSeats) ?? null;
  if (seats !== plan.maxActiveSeats) body.maxActiveSeats = seats;
  const sortOrder = toInteger(value.sortOrder) ?? null;
  if (sortOrder !== plan.sortOrder) body.sortOrder = sortOrder;
  const highlights = cleanHighlights(value.highlights);
  if (JSON.stringify(highlights) !== JSON.stringify(plan.highlights)) body.highlights = highlights;
  return body;
}

/** Campos del formulario que pintan su propio error (claves de Joi). */
const PLAN_FIELD_KEYS = new Set([
  "name",
  "description",
  "shortDescription",
  "priceCents",
  "annualPriceCents",
  "maxActiveSeats",
  "sortOrder",
  "highlights",
]);

export {
  EMPTY_PLAN_FORM,
  PLAN_FIELD_KEYS,
  planToFormValue,
  formValueToCreateBody,
  formValueToPatchBody,
};
export type { PlanFormValue, BillingMode };
