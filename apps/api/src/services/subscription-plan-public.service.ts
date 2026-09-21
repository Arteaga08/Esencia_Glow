import type {
  PublicSubscriptionEnrollment,
  PublicSubscriptionPlan,
  PublicSubscriptionPlanResult,
  PublicSubscriptionPlansResult,
} from "@esencia-glow/shared";
import { Settings } from "../models/settings.model.js";
import { SubscriptionPlan } from "../models/subscription-plan.model.js";
import { AppError } from "../utils/app-error.js";
import { isEnrollmentOpen } from "./subscription-enrollment.js";

/**
 * Catálogo público de planes (Milestone 1.7.3) — lecturas `lean` con
 * proyección mínima. La visibilidad es la misma regla que el alta
 * (`startSubscriptionForUser`): un plan que no está activo o no tiene precio
 * en Stripe no se puede contratar, así que tampoco se muestra.
 */

const SETTINGS_ID = "global";

const PUBLIC_PLAN_FILTER = { isActive: true, providerPriceId: { $type: "string" } } as const;

/** Solo lo que sale al público. Excluye a propósito `seatsTaken`,
 * `maxActiveSeats`, `providerProductId` y `providerPriceId`. `seatsTaken` y
 * `maxActiveSeats` SÍ se leen, pero únicamente para derivar `soldOut`. */
const PUBLIC_PLAN_PROJECTION = "name slug description shortDescription priceCents currency billingInterval seatsTaken maxActiveSeats";

interface LeanPublicPlan {
  _id: { toString(): string };
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  priceCents: number;
  currency: string;
  billingInterval: string;
  seatsTaken: number;
  maxActiveSeats: number;
}

function buildPublicPlan(plan: LeanPublicPlan): PublicSubscriptionPlan {
  return {
    id: plan._id.toString(),
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    ...(plan.shortDescription ? { shortDescription: plan.shortDescription } : {}),
    priceCents: plan.priceCents,
    currency: plan.currency,
    billingInterval: plan.billingInterval,
    soldOut: plan.seatsTaken >= plan.maxActiveSeats,
  };
}

/** Misma lectura y misma regla que `startSubscriptionForUser`: el subdocumento
 * CRUDO del singleton, porque `isEnrollmentOpen` pide `Date`, no el ISO del
 * contrato público de `getSettings()`. */
async function readEnrollment(now: Date): Promise<PublicSubscriptionEnrollment> {
  const settingsDoc = await Settings.findById(SETTINGS_ID).lean();
  const window = {
    enrollmentOpen: settingsDoc?.subscriptions?.enrollmentOpen ?? false,
    enrollmentClosesAt: settingsDoc?.subscriptions?.enrollmentClosesAt,
  };

  const open = isEnrollmentOpen(now, window);
  return {
    open,
    ...(open && window.enrollmentClosesAt ? { closesAt: window.enrollmentClosesAt.toISOString() } : {}),
  };
}

async function listPublicPlans(): Promise<PublicSubscriptionPlansResult> {
  const [plans, enrollment] = await Promise.all([
    SubscriptionPlan.find(PUBLIC_PLAN_FILTER)
      .sort({ sortOrder: 1, createdAt: 1, _id: 1 })
      .select(PUBLIC_PLAN_PROJECTION)
      .lean<LeanPublicPlan[]>(),
    readEnrollment(new Date()),
  ]);

  return { plans: plans.map(buildPublicPlan), enrollment };
}

async function getPublicPlanBySlug(slug: string): Promise<PublicSubscriptionPlanResult> {
  const [plan, enrollment] = await Promise.all([
    SubscriptionPlan.findOne({ ...PUBLIC_PLAN_FILTER, slug }).select(PUBLIC_PLAN_PROJECTION).lean<LeanPublicPlan>(),
    readEnrollment(new Date()),
  ]);
  if (!plan) {
    throw new AppError("Plan no encontrado", 404);
  }

  return { plan: buildPublicPlan(plan), enrollment };
}

export { listPublicPlans, getPublicPlanBySlug };
