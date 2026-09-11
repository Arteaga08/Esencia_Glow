import Joi from "joi";
import { OrderPriority, OrderStatus, ShippingCarrier } from "@esencia-glow/shared";
import { listQueryBaseSchema } from "./list-query.validator.js";
import { shippingAddressSchema } from "./shipping.validator.js";

const objectId = Joi.string().hex().length(24);

const listAdminOrdersQuerySchema = listQueryBaseSchema.keys({
  status: Joi.string().valid(...Object.values(OrderStatus)),
  group: Joi.string().valid("action", "progress", "shipping", "problems"),
  priority: Joi.string().valid(...Object.values(OrderPriority)),
  orderNumber: Joi.string().trim().max(20),
  incident: Joi.boolean(),
});

/**
 * Estatus a los que un actor `admin` puede transicionar (ver
 * `TRANSITION_ACTORS` en order-state.ts): NUNCA `paid` (solo el webhook,
 * §E del plan) ni `refunded` (solo `system`, 1.6). Restringir el enum aquí
 * evita un botón muerto en el panel — sin esto, la forma valida un target
 * que `assertTransition` siempre rechaza con 409.
 */
const ADMIN_REACHABLE_STATUSES = [
  OrderStatus.CANCELLED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
] as const;

const shipmentSchema = Joi.object({
  carrier: Joi.string()
    .valid(...Object.values(ShippingCarrier))
    .required(),
  carrierName: Joi.string().trim().max(80),
  trackingNumber: Joi.string().trim().min(1).max(80).required(),
  trackingUrl: Joi.string().trim().uri().max(500),
});

/** `shipment` es requerido SOLO al transicionar a `shipped` — la
 * transición va "con guía" (ver order-state.ts §D). */
const changeOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...ADMIN_REACHABLE_STATUSES)
    .required(),
  reason: Joi.string().trim().max(300),
  shipment: shipmentSchema.when("status", {
    is: OrderStatus.SHIPPED,
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
});

const updateOrderShipmentSchema = Joi.object({
  carrier: Joi.string().valid(...Object.values(ShippingCarrier)),
  carrierName: Joi.string().trim().max(80),
  trackingNumber: Joi.string().trim().min(1).max(80),
  trackingUrl: Joi.string().trim().uri().max(500),
}).min(1);

const changeOrderPrioritySchema = Joi.object({
  priority: Joi.string()
    .valid(...Object.values(OrderPriority))
    .required(),
});

const addInternalNoteSchema = Joi.object({
  body: Joi.string().trim().min(1).max(2000).required(),
});

const bulkChangeStatusSchema = Joi.object({
  orderIds: Joi.array().items(objectId.required()).min(1).max(50).required(),
  status: Joi.string()
    .valid(...ADMIN_REACHABLE_STATUSES)
    .required(),
  reason: Joi.string().trim().max(300),
});

/** Reusa el shape completo de `shipping.validator.ts` (todos los campos
 * obligatorios): la corrección es un reemplazo, no un parche. */
const correctShippingAddressSchema = shippingAddressSchema;

export {
  listAdminOrdersQuerySchema,
  changeOrderStatusSchema,
  updateOrderShipmentSchema,
  correctShippingAddressSchema,
  changeOrderPrioritySchema,
  addInternalNoteSchema,
  bulkChangeStatusSchema,
};
