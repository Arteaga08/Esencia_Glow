import { getFeaturedPlan } from "../../../../lib/storefront/subscription-plan";
import { buildPeriodViews, getAvailability } from "../../../../lib/storefront/subscription-periods";
import { SubscriptionSection } from "./subscription-section";

/**
 * Bloque 7 del home: la caja de suscripción con sus periodos de pago. Todo
 * viene del plan (Suscripciones > Planes en el panel): nombre, descripción,
 * foto, viñetas y precios. Sin plan público no se pinta.
 */
async function SubscriptionBlock() {
  const data = await getFeaturedPlan();
  const plan = data?.plans[0];
  if (!data || !plan) return null;

  const periods = buildPeriodViews(plan);
  const cover = plan.images[0];

  return (
    <SubscriptionSection
      name={plan.name}
      highlights={plan.highlights}
      periods={periods}
      availability={getAvailability(plan, data.enrollment)}
      photo={cover ? { url: cover.url, alt: cover.alt ?? plan.name } : null}
    />
  );
}

export { SubscriptionBlock };
