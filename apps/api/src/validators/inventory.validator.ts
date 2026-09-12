import Joi from "joi";
import { ReservationStatus, StockStatus } from "@esencia-glow/shared";
import { listQueryBaseSchema } from "./list-query.validator.js";

const objectId = Joi.string().hex().length(24);

const variantIdParamSchema = Joi.object({
  variantId: objectId.required().messages({
    "string.length": "Id de variante inválido",
    "string.hex": "Id de variante inválido",
  }),
});

const productIdParamSchema = Joi.object({
  productId: objectId.required().messages({
    "string.length": "Id de producto inválido",
    "string.hex": "Id de producto inválido",
  }),
});

/** Panel: una fila por producto, filtro por `status` derivado (no por
 * `productId`/`lowStock` crudos como en 1.4 — ver inventory-panel.service.ts). */
const listInventoryQuerySchema = listQueryBaseSchema.keys({
  status: Joi.string().valid(...Object.values(StockStatus)),
});

const listReservationsQuerySchema = listQueryBaseSchema.keys({
  status: Joi.string().valid(...Object.values(ReservationStatus)),
});

/** Alta de fila desde el panel: el `sku` NUNCA viaja en el body — se resuelve
 * del catálogo dentro del service (ver createInventoryItem). */
const createInventoryItemSchema = Joi.object({
  productId: objectId.required(),
  variantId: objectId.required(),
  onHand: Joi.number().integer().min(0).max(1_000_000).required(),
  lowStockThreshold: Joi.number().integer().min(0).max(100_000),
});

/**
 * Ajuste de stock: `delta` (entrada/baja relativa) y `onHand` (recuento
 * físico absoluto) son EXCLUSIVOS entre sí — nunca ambos, nunca ninguno.
 * `reason` es opcional: obligarlo es fricción inútil para la venta de
 * mostrador cuyo único motivo es "se vendió" (ver
 * ECOMMERCE_ARCHITECTURE_GUIDELINES.md §"Alta de stock híbrida").
 * `expectedOnHand` sigue siendo la guarda optimista opcional.
 */
const adjustStockSchema = Joi.object({
  delta: Joi.number().integer().invalid(0).messages({
    "any.invalid": "delta no puede ser 0",
  }),
  onHand: Joi.number().integer().min(0),
  reason: Joi.string().trim().max(200),
  expectedOnHand: Joi.number().integer().min(0),
})
  .xor("delta", "onHand")
  .messages({
    "object.xor": "Envía delta (movimiento relativo) o onHand (recuento absoluto), nunca ambos ni ninguno",
  });

/** `lowStockThreshold: null` hace `$unset` (vuelve a usar el default global). */
const updateThresholdSchema = Joi.object({
  lowStockThreshold: Joi.number().integer().min(0).max(100_000).allow(null).required(),
});

export {
  variantIdParamSchema,
  productIdParamSchema,
  listInventoryQuerySchema,
  listReservationsQuerySchema,
  createInventoryItemSchema,
  adjustStockSchema,
  updateThresholdSchema,
};
