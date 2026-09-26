import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as shipmentController from "../controllers/shipment.controller.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { validate } from "../middlewares/validate.js";
import { listAdminShipmentsQuerySchema } from "../validators/shipment-admin.validator.js";

/**
 * `/api/v1/admin/shipments` (Milestone 2.4): solo lectura, envíos de
 * TIENDA. Las acciones (reintentar guía, corregir guía) siguen viviendo en
 * `/admin/orders/:id/...` — esta pantalla las reutiliza, no las duplica.
 */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/", validate(listAdminShipmentsQuerySchema, "query"), shipmentController.list);

export { router as adminShipmentRoutes };
