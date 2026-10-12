import Joi from "joi";

const nameSchema = Joi.string().trim().min(1).max(80).messages({
  "string.empty": "El nombre es obligatorio",
  "string.min": "El nombre es obligatorio",
  "string.max": "El nombre no puede tener más de 80 caracteres",
});

const showOnHomeSchema = Joi.boolean().messages({ "boolean.base": "Indica si la marca se muestra en el home" });

const createBrandSchema = Joi.object({
  name: nameSchema.required().messages({ "any.required": "El nombre es obligatorio" }),
  showOnHome: showOnHomeSchema,
});

const updateBrandSchema = Joi.object({
  name: nameSchema,
  showOnHome: showOnHomeSchema,
}).min(1);

export { createBrandSchema, updateBrandSchema };
