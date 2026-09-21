/**
 * Catálogo público de planes de suscripción (Milestone 1.7.3) — lo que el
 * storefront pinta ANTES de que la visitante tenga cuenta. Mismo criterio que
 * la disponibilidad pública de productos: una SEÑAL (`soldOut`), nunca el
 * contador de cupo, y ningún id del proveedor de pagos.
 */
interface PublicSubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  priceCents: number;
  currency: string;
  billingInterval: string;
  /** El plan llegó a su tope de cupo: no se puede contratar por ahora. */
  soldOut: boolean;
}

/** Estado de la ventana de inscripciones: controla solo ALTAS nuevas (las
 * renovaciones, reanudar y cambiar de plan no dependen de ella). `closesAt`
 * solo viaja mientras la ventana está abierta y tiene fecha de cierre. */
interface PublicSubscriptionEnrollment {
  open: boolean;
  closesAt?: string;
}

interface PublicSubscriptionPlansResult {
  plans: PublicSubscriptionPlan[];
  enrollment: PublicSubscriptionEnrollment;
}

interface PublicSubscriptionPlanResult {
  plan: PublicSubscriptionPlan;
  enrollment: PublicSubscriptionEnrollment;
}

export type {
  PublicSubscriptionPlan,
  PublicSubscriptionEnrollment,
  PublicSubscriptionPlansResult,
  PublicSubscriptionPlanResult,
};
