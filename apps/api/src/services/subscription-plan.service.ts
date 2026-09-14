import { CATALOG_CURRENCY, type ListQuery, type PaginationMeta } from "@esencia-glow/shared";
import { SubscriptionPlan, type SubscriptionPlanDocument } from "../models/subscription-plan.model.js";
import { AppError } from "../utils/app-error.js";
import { slugify } from "../utils/slugify.js";
import { buildMeta, escapeRegex } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import { buildAdminSubscriptionPlan, type AdminSubscriptionPlan, type LeanSubscriptionPlan } from "./subscription-dto.js";
import { resolveSubscriptionProvider } from "./subscription-provider.js";

const PLAN_SORT_FIELDS = ["sortOrder", "createdAt", "name", "priceCents"] as const;

interface CreateSubscriptionPlanInput {
  name: string;
  description: string;
  shortDescription?: string;
  priceCents: number;
  maxActiveSeats: number;
  sortOrder?: number;
}

/**
 * `maxActiveSeats` no viaja aquí suelto: cambiarlo pasa por la guarda
 * atómica de `updatePlan` (el cupo no puede bajar por debajo de las
 * suscriptoras vigentes). `isActive` tampoco: la baja tiene su propio
 * endpoint (`deactivatePlan`), con su propia guarda de cupo. **`priceCents`
 * NO existe aquí** (decisión 1 de 1.7.2a): un `Price` de Stripe es
 * inmutable PARA SIEMPRE, incluso con `seatsTaken: 0` — cambiar el precio de
 * un plan es crear un plan nuevo y desactivar el viejo, nunca un PATCH.
 */
interface UpdateSubscriptionPlanInput {
  name?: string;
  description?: string;
  shortDescription?: string;
  maxActiveSeats?: number;
  sortOrder?: number;
}

interface ListSubscriptionPlansInput extends ListQuery {
  isActive?: boolean;
}

/**
 * Sincroniza Product+Price en Stripe Billing ANTES de insertar el documento
 * local (decisión 1 de 1.7.2a) — nunca al revés: un plan sin refs es
 * inservible (nadie podría suscribirse), mientras que un Product/Price
 * huérfano en Stripe por un fallo posterior al guardar es inofensivo y
 * reutilizable si el admin reintenta con el mismo nombre (misma
 * `idempotencyKey`, derivada del slug). 503 sin proveedor configurado —
 * mismo criterio que `ensurePaymentIntent` en el checkout: sin este guard,
 * cada intento en un entorno sin Stripe fallaría más adelante de forma
 * menos clara.
 */
async function createPlan(input: CreateSubscriptionPlanInput): Promise<SubscriptionPlanDocument> {
  const provider = resolveSubscriptionProvider();
  if (!provider) throw new AppError("Las suscripciones no están configuradas.", 503);

  const slug = slugify(input.name);
  const { productRef, priceRef } = await provider.createPlanProduct({
    planSlug: slug,
    name: input.name,
    description: input.description,
    priceCents: input.priceCents,
    currency: CATALOG_CURRENCY,
    idempotencyKey: `plan:${slug}`,
  });

  const plan = new SubscriptionPlan({
    name: input.name,
    slug,
    description: input.description,
    shortDescription: input.shortDescription,
    priceCents: input.priceCents,
    maxActiveSeats: input.maxActiveSeats,
    sortOrder: input.sortOrder,
    providerProductId: productRef,
    providerPriceId: priceRef,
  });
  await plan.save();
  return plan;
}

async function getPlanDocument(id: string): Promise<SubscriptionPlanDocument> {
  const plan = await SubscriptionPlan.findById(id);
  if (!plan) throw new AppError("Plan de suscripción no encontrado", 404);
  return plan;
}

async function assertPlanExists(id: string): Promise<void> {
  const exists = await SubscriptionPlan.exists({ _id: id });
  if (!exists) throw new AppError("Plan de suscripción no encontrado", 404);
}

/**
 * Bajar el cupo por debajo de las suscriptoras vigentes: condición y
 * escritura en el mismo `findOneAndUpdate`, nunca leer `seatsTaken` y decidir
 * en JS — una suscriptora entrando en el instante entre esa lectura y esta
 * escritura dejaría `seatsTaken > maxActiveSeats`.
 */
async function applyMaxActiveSeats(id: string, maxActiveSeats: number): Promise<void> {
  const updated = await SubscriptionPlan.findOneAndUpdate(
    { _id: id, $expr: { $lte: ["$seatsTaken", maxActiveSeats] } },
    { $set: { maxActiveSeats } },
    { new: true },
  );
  if (updated) return;
  await assertPlanExists(id);
  throw new AppError("Ya hay más suscriptoras activas que el nuevo cupo.", 409);
}

async function updatePlan(id: string, input: UpdateSubscriptionPlanInput): Promise<SubscriptionPlanDocument> {
  if (input.maxActiveSeats !== undefined) await applyMaxActiveSeats(id, input.maxActiveSeats);

  const plan = await getPlanDocument(id);
  if (input.name !== undefined) {
    plan.name = input.name;
    plan.slug = slugify(input.name);
  }
  if (input.description !== undefined) plan.description = input.description;
  if (input.shortDescription !== undefined) plan.shortDescription = input.shortDescription;
  if (input.sortOrder !== undefined) plan.sortOrder = input.sortOrder;

  await plan.save();
  return plan;
}

/**
 * "Eliminar" un plan desactiva, nunca borra: `SubscriptionAccount` lo
 * referencia. Bloqueado si aún tiene suscriptoras activas — desactivar no
 * las cancela, así que dejarlo pasar dejaría cuentas vigentes apuntando a un
 * plan que ya no admite altas nuevas, en un estado ambiguo.
 *
 * Mismo patrón atómico que `applyPriceCents`, no un `getPlanDocument` +
 * `save()`: leer `seatsTaken` y decidir en JS deja una ventana entre esa
 * lectura y la escritura donde `claimSeat` puede incrementar el contador —
 * `save()` de Mongoose solo envía los campos modificados (`isActive`), así
 * que el resultado sería un plan `isActive: false` con `seatsTaken > 0`
 * (hallazgo de code review de 1.7.1).
 */
async function deactivatePlan(id: string): Promise<void> {
  const updated = await SubscriptionPlan.findOneAndUpdate(
    { _id: id, seatsTaken: 0 },
    { $set: { isActive: false } },
    { new: true },
  );
  if (updated) return;
  await assertPlanExists(id);
  throw new AppError("No puedes desactivar un plan con suscriptoras activas.", 409);
}

async function listPlans(
  input: ListSubscriptionPlansInput,
): Promise<{ plans: AdminSubscriptionPlan[]; meta: PaginationMeta }> {
  const filter: Record<string, unknown> = {};
  if (input.isActive !== undefined) filter.isActive = input.isActive;
  if (input.search) filter.name = new RegExp(escapeRegex(input.search), "i");

  const sort = resolveSort(input.sort, PLAN_SORT_FIELDS, "sortOrder");

  const [documents, total] = await Promise.all([
    SubscriptionPlan.find(filter)
      .sort(sort)
      .skip((input.page - 1) * input.limit)
      .limit(input.limit)
      .lean<LeanSubscriptionPlan[]>(),
    SubscriptionPlan.countDocuments(filter),
  ]);

  return { plans: documents.map(buildAdminSubscriptionPlan), meta: buildMeta(total, input) };
}

async function getPlanById(id: string): Promise<AdminSubscriptionPlan> {
  const plan = await SubscriptionPlan.findById(id).lean<LeanSubscriptionPlan>();
  if (!plan) throw new AppError("Plan de suscripción no encontrado", 404);
  return buildAdminSubscriptionPlan(plan);
}

export { createPlan, updatePlan, deactivatePlan, listPlans, getPlanById, getPlanDocument };
export type { CreateSubscriptionPlanInput, UpdateSubscriptionPlanInput, ListSubscriptionPlansInput };
