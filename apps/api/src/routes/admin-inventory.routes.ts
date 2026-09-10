import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as inventoryController from "../controllers/inventory.controller.js";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { objectIdParamSchema } from "../validators/media.validator.js";
import {
  adjustStockSchema,
  listInventoryQuerySchema,
  listReservationsQuerySchema,
  variantIdParamSchema,
} from "../validators/inventory.validator.js";

/**
 * Router de /api/v1/admin/inventory. Sin superficie HTTP para reserve/commit:
 * en 1.4 no hay carrito ni webhook de pago que las dispare — se prueban a
 * nivel de service y las conecta 1.5. `/reservations*` va ANTES de
 * `/:variantId` para que Express no confunda "reservations" con un id.
 */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/", validate(listInventoryQuerySchema, "query"), inventoryController.list);
router.get(
  "/reservations",
  validate(listReservationsQuerySchema, "query"),
  inventoryController.listReservations,
);
router.post(
  "/reservations/:id/release",
  validate(objectIdParamSchema, "params"),
  inventoryController.forceRelease,
);
router.get("/:variantId", validate(variantIdParamSchema, "params"), inventoryController.getOne);
router.post(
  "/:variantId/adjust",
  validate(variantIdParamSchema, "params"),
  validate(adjustStockSchema),
  inventoryController.adjust,
);

export { router as adminInventoryRoutes };
