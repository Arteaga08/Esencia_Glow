import Joi from "joi";
import { OverviewRange } from "@esencia-glow/shared";

/** `GET /admin/overview/sales` (Milestone 2.9). `range` es obligatorio: a
 * diferencia de `topCustomersQuerySchema`, no hay un default razonable que
 * el controlador pueda aplicar en silencio — la UI siempre manda su
 * selector. */
const overviewSalesQuerySchema = Joi.object({
  range: Joi.string()
    .valid(...Object.values(OverviewRange))
    .required()
    .messages({
      "any.required": "Selecciona un rango (día, semana, mes o año).",
      "any.only": "El rango debe ser día, semana, mes o año.",
    }),
});

export { overviewSalesQuerySchema };
