import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as customerAdminController from "../controllers/customer-admin.controller.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { validate } from "../middlewares/validate.js";
import { objectIdParamSchema } from "../validators/media.validator.js";
import { listAdminCustomersQuerySchema } from "../validators/customer-admin.validator.js";

/**
 * `/api/v1/admin/customers` (Milestone 2.6) — solo lectura: listado con
 * búsqueda y detalle con pedidos/suscripción. Ver [[esencia-glow-2-6]] para
 * el TODO de acciones diferidas (dar cupón).
 */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/", validate(listAdminCustomersQuerySchema, "query"), customerAdminController.list);
router.get("/:id", validate(objectIdParamSchema, "params"), customerAdminController.getOne);

export { router as adminCustomerRoutes };
