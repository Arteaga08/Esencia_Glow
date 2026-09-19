import Joi from "joi";
import { ShippingCarrier, SubscriptionShipmentStatus } from "@esencia-glow/shared";

/**
 * Transición del envío desde el panel (Milestone 1.7.2b). La guía es
 * requerida CONDICIONALMENTE: solo al marcar `shipped`, que es la única
 * transición donde la caja sale físicamente y la suscriptora necesita algo
 * que rastrear. El service repite la guarda a propósito — el validator
 * protege el contrato HTTP, el service protege la invariante aunque lo
 * llame otro camino (un job de 1.7.3, por ejemplo).
 */
const changeShipmentStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(SubscriptionShipmentStatus))
    .required(),
  carrier: Joi.string()
    .valid(...Object.values(ShippingCarrier))
    .when("status", {
      is: SubscriptionShipmentStatus.SHIPPED,
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
  trackingNumber: Joi.string()
    .trim()
    .min(3)
    .max(60)
    .when("status", {
      is: SubscriptionShipmentStatus.SHIPPED,
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
});

export { changeShipmentStatusSchema };
