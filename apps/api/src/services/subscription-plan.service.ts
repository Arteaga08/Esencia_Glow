import type { ListQuery, PaginationMeta } from "@esencia-glow/shared";
import { SubscriptionPlan, type SubscriptionPlanDocument } from "../models/subscription-plan.model.js";
import { AppError } from "../utils/app-error.js";
import { slugify } from "../utils/slugify.js";
import { buildMeta, escapeRegex } from "../utils/parse-list-query.js";
import { resolveSort } from "../utils/resolve-sort.js";
import { buildAdminSubscriptionPlan, type AdminSubscriptionPlan, type LeanSubscriptionPlan } from "./subscription-dto.js";

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
 * `priceCents`/`maxActiveSeats` no viajan aquí sueltos: cambiarlos pasa por
 * las guardas atómicas de `updatePlan` (decisión 7 del plan de 1.7.1 — un
 * `Price` de Stripe es inmutable, y el cupo no puede bajar por debajo de las
 * suscriptoras vigentes). `isActive` tampoco: la baja tiene su propio
 * endpoint (`deactivatePlan`), con su propia guarda de cupo.
 */
interface UpdateSubscriptionPlanInput {
  name?: string;
  description?: string;
  shortDescription?: string;
  priceCents?: number;
  maxActiveSeats?: number;
  sortOrder?: number;
}

interface ListSubscriptionPlansInput extends ListQuery {
  isActive?: boolean;
}

async function createPlan(input: CreateSubscriptionPlanInput): Promise<SubscriptionPlanDocument> {
  const plan = new SubscriptionPlan({
    name: input.name,
    slug: slugify(input.name),
    description: input.description,
    shortDescription: input.shortDescription,
    priceCents: input.priceCents,
    maxActiveSeats: input.maxActiveSeats,
    sortOrder: input.sortOrder,
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

/**
 * Un `Price` de Stripe es inmutable: cambiar el precio con suscriptoras
 * vigentes dejaría planes cuyo precio local no corresponde a ningún Price
 * real. Con `seatsTaken: 0` se permite libremente; con suscriptoras, cambiar
 * el precio es trabajo de migración de 1.7.2, no un PATCH.
 */
async function applyPriceCents(id: string, priceCents: number): Promise<void> {
  const updated = await SubscriptionPlan.findOneAndUpdate(
    { _id: id, seatsTaken: 0 },
    { $set: { priceCents } },
    { new: true },
  );
  if (updated) return;
  await assertPlanExists(id);
  throw new AppError("No puedes cambiar el precio de un plan con suscriptoras activas.", 409);
}

async function updatePlan(id: string, input: UpdateSubscriptionPlanInput): Promise<SubscriptionPlanDocument> {
  if (input.maxActiveSeats !== undefined) await applyMaxActiveSeats(id, input.maxActiveSeats);
  if (input.priceCents !== undefined) await applyPriceCents(id, input.priceCents);

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
