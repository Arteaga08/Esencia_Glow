import { mongoSanitize } from "./mongo-sanitize.js";
import { sanitizeInput } from "./sanitize-input.js";

/**
 * `express.json()` no parsea multipart/form-data: cuando la request llega a
 * una ruta de upload, la cadena global (mongoSanitize + sanitizeInput) ya
 * corrió sobre un body vacío, antes de que multer poblara `req.body` con los
 * campos de texto del form. Ambos middlewares son idempotentes y solo tocan
 * req.body/params/query, así que re-ejecutarlos después de multer cubre esos
 * campos sin duplicar lógica (BACKEND_SECURITY_GUIDELINES.md §5).
 *
 * Va ANTES de `validate(schema)`: `sanitizeInput` puede alargar un string al
 * escapar ("<" -> "&lt;"), y el `max()` de Joi debe medir el valor que
 * realmente se guarda.
 */
const sanitizeMultipart = [mongoSanitize, sanitizeInput];

export { sanitizeMultipart };
