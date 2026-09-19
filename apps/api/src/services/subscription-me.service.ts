import type { Types } from "mongoose";
import type {
  MySubscription,
  MySubscriptionShipment,
  ShippingCarrier,
  SubscriptionShipmentStatus,
} from "@esencia-glow/shared";
import { SubscriptionAccount } from "../models/subscription-account.model.js";
import { SubscriptionPlan } from "../models/subscription-plan.model.js";
import { SubscriptionShipment } from "../models/subscription-shipment.model.js";
import { AppError } from "../utils/app-error.js";

/**
 * Lectura de la propia suscripción (`GET /subscriptions/me`, Milestone
 * 1.7.2b). Devuelve `null` cuando la usuaria nunca se suscribió: "todavía no
 * soy suscriptora" es un estado normal del storefront, no un error — el 404
 * obligaría al front a tratar el camino más común como excepción.
 *
 * Las cajas se filtran por `userId` directo, que `SubscriptionShipment`
 * denormaliza justamente para esto (ver el docblock del modelo): resolverlas
 * vía `accountId` sería leer-y-comparar la propiedad en JS, el anti-patrón
 * que el resto del módulo evita.
 */

/** Tope de cajas devueltas. Una suscripción mensual tarda 4 años en
 * producir 48 cajas, así que esto no pagina nada en la práctica — es el
 * cinturón que evita que una respuesta crezca sin límite con los años. */
const MAX_SHIPMENTS = 48;

interface LeanShipmentForCustomer {
  _id: Types.ObjectId;
  cycleYear: number;
  cycleMonth: number;
  status: SubscriptionShipmentStatus;
  carrier?: ShippingCarrier;
  trackingNumber?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
}

function buildMyShipment(shipment: LeanShipmentForCustomer): MySubscriptionShipment {
  return {
    id: shipment._id.toString(),
    cycleYear: shipment.cycleYear,
    cycleMonth: shipment.cycleMonth,
    status: shipment.status,
    ...(shipment.carrier ? { carrier: shipment.carrier } : {}),
    ...(shipment.trackingNumber ? { trackingNumber: shipment.trackingNumber } : {}),
    ...(shipment.shippedAt ? { shippedAt: shipment.shippedAt.toISOString() } : {}),
    ...(shipment.deliveredAt ? { deliveredAt: shipment.deliveredAt.toISOString() } : {}),
  };
}

async function getMySubscription(userId: string): Promise<MySubscription | null> {
  const account = await SubscriptionAccount.findOne({ userId }).lean();
  if (!account) return null;

  const [plan, shipments] = await Promise.all([
    SubscriptionPlan.findById(account.planId).select("name description priceCents currency").lean(),
    SubscriptionShipment.find({ userId })
      .sort({ cycleYear: -1, cycleMonth: -1 })
      .limit(MAX_SHIPMENTS)
      .select("cycleYear cycleMonth status carrier trackingNumber shippedAt deliveredAt")
      .lean<LeanShipmentForCustomer[]>(),
  ]);

  // El plan es obligatorio por construcción (no se puede crear una cuenta sin
  // él y los planes no se borran, solo se desactivan): si falta, los datos
  // están corruptos y devolver una suscripción a medias sería peor.
  if (!plan) {
    throw new AppError("No pudimos cargar tu suscripción, contacta a soporte.", 500);
  }

  return {
    id: account._id.toString(),
    status: account.status,
    plan: {
      id: account.planId.toString(),
      name: plan.name,
      description: plan.description,
      priceCents: plan.priceCents,
      currency: plan.currency,
    },
    ...(account.currentPeriodEnd ? { nextChargeAt: account.currentPeriodEnd.toISOString() } : {}),
    cancelAtPeriodEnd: account.cancelAtPeriodEnd,
    dunningAttempts: account.dunningAttempts,
    ...(account.startedAt ? { startedAt: account.startedAt.toISOString() } : {}),
    shipments: shipments.map(buildMyShipment),
  };
}

export { getMySubscription };
