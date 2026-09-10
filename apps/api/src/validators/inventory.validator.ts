import Joi from "joi";
import { ReservationStatus } from "@esencia-glow/shared";
import { listQueryBaseSchema } from "./list-query.validator.js";

const objectId = Joi.string().hex().length(24);

const variantIdParamSchema = Joi.object({
  variantId: objectId.required().messages({
    "string.length": "Id de variante inválido",
    "string.hex": "Id de variante inválido",
  }),
});

const listInventoryQuerySchema = listQueryBaseSchema.keys({
  productId: objectId,
  lowStock: Joi.boolean(),
});

const listReservationsQuerySchema = listQueryBaseSchema.keys({
  status: Joi.string().valid(...Object.values(ReservationStatus)),
});

/**
 * `delta` nunca 0 (no tendría efecto) y nunca `onHand` absoluto: un valor
 * absoluto permitiría un lost update si dos admins ajustan a la vez viendo
 * el mismo número desactualizado en pantalla — ver inventory.service.ts.
 * `expectedOnHand` es la guarda optimista opcional para ese caso.
 */
const adjustStockSchema = Joi.object({
  delta: Joi.number().integer().invalid(0).required().messages({
    "any.invalid": "delta no puede ser 0",
    "any.required": "delta es requerido",
  }),
  reason: Joi.string().trim().min(3).max(200).required(),
  expectedOnHand: Joi.number().integer().min(0),
});

export {
  variantIdParamSchema,
  listInventoryQuerySchema,
  listReservationsQuerySchema,
  adjustStockSchema,
};
