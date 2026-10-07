import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as customerAdminController from "../controllers/customer-admin.controller.js";
import * as couponAdminController from "../controllers/coupon-admin.controller.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { validate } from "../middlewares/validate.js";
import { objectIdParamSchema } from "../validators/media.validator.js";
import { listAdminCustomersQuerySchema, topCustomersQuerySchema } from "../validators/customer-admin.validator.js";
import { giveCouponSchema } from "../validators/coupon-admin.validator.js";

/**
 * `/api/v1/admin/customers` (Milestone 2.6): listado con búsqueda y detalle
 * con pedidos/suscripción. La única acción es "dar cupón" (Milestone 3.7).
 */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/", validate(listAdminCustomersQuerySchema, "query"), customerAdminController.list);
// Antes de `/:id`: si no, "top" se validaría como ObjectId y daría 400.
router.get("/top", validate(topCustomersQuerySchema, "query"), customerAdminController.top);
router.get("/:id", validate(objectIdParamSchema, "params"), customerAdminController.getOne);
router.post("/:id/coupons", validate(objectIdParamSchema, "params"), validate(giveCouponSchema), couponAdminController.give);

export { router as adminCustomerRoutes };
