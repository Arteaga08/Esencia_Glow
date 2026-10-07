import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as couponAdminController from "../controllers/coupon-admin.controller.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { validate } from "../middlewares/validate.js";
import { objectIdParamSchema } from "../validators/media.validator.js";
import { createCouponSchema, listCouponsQuerySchema, setCouponActiveSchema } from "../validators/coupon-admin.validator.js";

/**
 * `/api/v1/admin/coupons` (Milestone 3.7): listar, crear cupones públicos y
 * activar/desactivar. Un cupón creado no se edita (no cambia de valor).
 * "Dar cupón" a una clienta cuelga de `/admin/customers/:id/coupons`.
 */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/", validate(listCouponsQuerySchema, "query"), couponAdminController.list);
router.post("/", validate(createCouponSchema), couponAdminController.create);
router.patch("/:id", validate(objectIdParamSchema, "params"), validate(setCouponActiveSchema), couponAdminController.setActive);

export { router as adminCouponRoutes };
