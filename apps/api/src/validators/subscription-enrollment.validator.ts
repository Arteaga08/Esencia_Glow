import Joi from "joi";

/** `durationDays` opcional — ausente usa `SUBSCRIPTION_ENROLLMENT_DEFAULT_DAYS`
 * (ver subscription-enrollment.service.ts). Tope de 90: una ventana más
 * larga que eso no es una "ventana de inscripciones", es dejarla abierta
 * indefinidamente, que se logra reabriendo. `.default({})`: a diferencia de
 * los demás PATCH de Settings, aquí un body TOTALMENTE vacío es válido
 * (abrir con la duración default) — sin el default, un `POST` sin body
 * dejaría `req.body` en `undefined` en vez de `{}` y el service reventaría
 * al leer `durationDays`. */
const openEnrollmentSchema = Joi.object({
  durationDays: Joi.number().integer().min(1).max(90),
}).default({});

export { openEnrollmentSchema };
