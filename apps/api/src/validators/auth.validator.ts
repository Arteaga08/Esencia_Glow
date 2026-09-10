import Joi from "joi";

/**
 * Schemas de entrada de /api/v1/auth. `role` y `emailVerified` no aparecen en
 * ningún schema — son campos derivados, nunca vienen del payload.
 * Política de contraseña: mínimo 10 caracteres, al menos una mayúscula, una
 * minúscula y un dígito.
 */

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;
const PASSWORD_MESSAGE =
  "La contraseña debe tener al menos 10 caracteres, con mayúscula, minúscula y número";

const emailSchema = Joi.string().trim().lowercase().email().required().messages({
  "string.email": "Correo inválido",
  "any.required": "El correo es requerido",
});

const passwordSchema = Joi.string().pattern(PASSWORD_PATTERN).required().messages({
  "string.pattern.base": PASSWORD_MESSAGE,
  "any.required": "La contraseña es requerida",
});

const registerSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: Joi.string().trim().min(1).max(80).required(),
  lastName: Joi.string().trim().min(1).max(80).required(),
});

const loginSchema = Joi.object({
  email: emailSchema,
  password: Joi.string().required().messages({ "any.required": "La contraseña es requerida" }),
});

const twoFactorLoginSchema = Joi.object({
  code: Joi.string().trim().length(6).pattern(/^\d+$/).required().messages({
    "string.length": "El código debe tener 6 dígitos",
    "string.pattern.base": "El código debe ser numérico",
  }),
});

const emailOnlySchema = Joi.object({ email: emailSchema });

const verifyEmailSchema = Joi.object({
  token: Joi.string().trim().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().trim().required(),
  password: passwordSchema,
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: passwordSchema,
});

const twoFactorCodeSchema = Joi.object({
  code: Joi.string().trim().length(6).pattern(/^\d+$/).required().messages({
    "string.length": "El código debe tener 6 dígitos",
    "string.pattern.base": "El código debe ser numérico",
  }),
});

export {
  registerSchema,
  loginSchema,
  twoFactorLoginSchema,
  emailOnlySchema,
  verifyEmailSchema,
  resetPasswordSchema,
  changePasswordSchema,
  twoFactorCodeSchema,
};
