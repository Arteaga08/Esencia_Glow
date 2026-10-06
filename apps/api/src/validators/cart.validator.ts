import Joi from "joi";
import { MAX_ORDER_LINES } from "@esencia-glow/shared";

/**
 * Body de `POST /cart/resolve`. Solo identidad de cada línea (tipo + id):
 * deliberadamente sin cantidades ni montos — con `stripUnknown` en el
 * middleware `validate`, cualquier cantidad o precio que mande el cliente se
 * descarta antes de llegar al service, que lee todo de la DB.
 */
const resolveCartLineSchema = Joi.object({
  itemType: Joi.string().valid("product", "bundle").required(),
  itemId: Joi.string().hex().length(24).required(),
});

const resolveCartSchema = Joi.object({
  lines: Joi.array().items(resolveCartLineSchema).min(1).max(MAX_ORDER_LINES).required(),
});

export { resolveCartSchema };
