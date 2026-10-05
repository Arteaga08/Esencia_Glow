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
// bcrypt solo lee los primeros 72 BYTES: más allá, dos contraseñas distintas
// producirían el mismo hash. Se cuenta en bytes (un emoji pesa 4), no en
// caracteres.
const PASSWORD_MAX_BYTES = 72;
const PASSWORD_TOO_LONG_MESSAGE = "La contraseña no puede pasar de 72 caracteres";
const EMAIL_MAX_LENGTH = 254;

const emailSchema = Joi.string().trim().lowercase().max(EMAIL_MAX_LENGTH).email().required().messages({
  "string.email": "Correo inválido",
  "string.max": "Correo inválido",
  "any.required": "El correo es requerido",
});

const passwordSchema = Joi.string()
  .pattern(PASSWORD_PATTERN)
  .custom((value: string, helpers) => (Buffer.byteLength(value, "utf8") > PASSWORD_MAX_BYTES ? helpers.error("password.tooLong") : value))
  .required()
  .messages({
    "string.pattern.base": PASSWORD_MESSAGE,
    "password.tooLong": PASSWORD_TOO_LONG_MESSAGE,
    "any.required": "La contraseña es requerida",
  });

const registerSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: Joi.string().trim().min(2).max(60).required(),
  lastName: Joi.string().trim().min(2).max(60).required(),
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

// La contraseña confirma que quien abre el enlace es quien creó la cuenta
// (ver account.service.verifyEmail); no se le aplica la política, solo un tope
// para no pagar bcrypt sobre cuerpos enormes.
const verifyEmailSchema = Joi.object({
  token: Joi.string().trim().required(),
  password: Joi.string().max(128).required().messages({ "any.required": "La contraseña es requerida" }),
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

// El código solo es obligatorio cuando la cuenta ya tiene 2FA activado, algo
// que el validator no puede saber (depende del estado en BD); esa exigencia
// la aplica el servicio, aquí solo se valida el formato si viene.
const twoFactorSetupSchema = Joi.object({
  code: Joi.string().trim().length(6).pattern(/^\d+$/).optional().messages({
    "string.length": "El código debe tener 6 dígitos",
    "string.pattern.base": "El código debe ser numérico",
  }),
}).default({});

// Body vacío a propósito: a diferencia de `twoFactorSetupSchema` (setup
// AUTENTICADO, que acepta un `code` opcional para reconfigurar 2FA ya
// activo), este es el paso pre-auth de enrolamiento OBLIGATORIO — nunca debe
// poder derivar a esa rama de reconfiguración, así que ni siquiera declara
// el campo (con `stripUnknown` de `validate()`, cualquier `code` que llegue
// se descarta antes de tocar el service).
const twoFactorEnrollmentSetupSchema = Joi.object({}).default({});

export {
  registerSchema,
  loginSchema,
  twoFactorLoginSchema,
  emailOnlySchema,
  verifyEmailSchema,
  resetPasswordSchema,
  changePasswordSchema,
  twoFactorCodeSchema,
  twoFactorSetupSchema,
  twoFactorEnrollmentSetupSchema,
};
