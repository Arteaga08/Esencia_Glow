import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as subscriptionEnrollmentController from "../controllers/subscription-enrollment.controller.js";
import * as subscriptionAccountAdminController from "../controllers/subscription-account-admin.controller.js";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { openEnrollmentSchema } from "../validators/subscription-enrollment.validator.js";
import { listAdminSubscriptionAccountsQuerySchema } from "../validators/subscription-account-admin.validator.js";
import { objectIdParamSchema } from "../validators/media.validator.js";

/**
 * Router de /api/v1/admin/subscriptions. `/enrollment/open|close`
 * (Milestone 1.7.2a) son endpoints propios (no un PATCH genérico de
 * Settings) porque abrir/cerrar inscripciones son ACCIONES auditables — ver
 * subscription-enrollment.controller.ts. El listado/detalle/`/activity` de
 * Cuentas (Milestone 2.7a, solo lectura) se montan ANTES que ninguna otra
 * ruta con `:id` pudiera confundirlos — hoy no hay colisión real
 * (`enrollment` no es un ObjectId hexadecimal de 24 caracteres), pero se
 * deja el orden explícito por si esta lista de rutas crece.
 */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/", validate(listAdminSubscriptionAccountsQuerySchema, "query"), subscriptionAccountAdminController.list);
router.get("/:id", validate(objectIdParamSchema, "params"), subscriptionAccountAdminController.getOne);
router.get("/:id/activity", validate(objectIdParamSchema, "params"), subscriptionAccountAdminController.activity);

router.post("/enrollment/open", validate(openEnrollmentSchema), subscriptionEnrollmentController.open);
router.post("/enrollment/close", subscriptionEnrollmentController.close);

export { router as adminSubscriptionRoutes };
