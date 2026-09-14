import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as subscriptionEnrollmentController from "../controllers/subscription-enrollment.controller.js";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { openEnrollmentSchema } from "../validators/subscription-enrollment.validator.js";

/**
 * Router de /api/v1/admin/subscriptions (Milestone 1.7.2a). Endpoints
 * propios (no un PATCH genérico de Settings) porque abrir/cerrar
 * inscripciones son ACCIONES auditables — ver
 * subscription-enrollment.controller.ts.
 */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.post("/enrollment/open", validate(openEnrollmentSchema), subscriptionEnrollmentController.open);
router.post("/enrollment/close", subscriptionEnrollmentController.close);

export { router as adminSubscriptionRoutes };
