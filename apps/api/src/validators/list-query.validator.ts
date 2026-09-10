import Joi from "joi";

/**
 * Base reusable por todo listado administrativo o público paginado. Es
 * obligatoria: `validate(schema, "query")` corre con `stripUnknown: true`, así
 * que un schema de listado que no declare page/limit/sort/search los borra
 * antes de que `parseListQuery` (utils/parse-list-query.ts) los vea. Cada
 * listado extiende esto con `.keys({ ...filtros propios })`.
 */
const listQueryBaseSchema = Joi.object({
  page: Joi.number().integer().min(1),
  // Sin .max() aquí a propósito: un limit fuera de rango no se rechaza, se
  // topa en silencio — lo hace parseListQuery (utils/parse-list-query.ts,
  // MAX_LIMIT=100). `.integer()` ya exige un entero seguro, así que un valor
  // absurdo nunca llega a Mongo sin pasar por ese clamp.
  limit: Joi.number().integer().min(1),
  sort: Joi.string()
    .max(40)
    .pattern(/^-?[a-zA-Z][a-zA-Z0-9]*$/),
  // Acotado a 80 chars para topear el costo del $regex (ya viene escapado por
  // escapeRegex, pero un patrón larguísimo sigue siendo un scan más caro).
  search: Joi.string().trim().max(80).allow(""),
});

export { listQueryBaseSchema };
