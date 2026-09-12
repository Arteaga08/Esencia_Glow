import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as inventoryController from "../controllers/inventory.controller.js";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { objectIdParamSchema } from "../validators/media.validator.js";
import {
  adjustStockSchema,
  createInventoryItemSchema,
  listInventoryQuerySchema,
  listReservationsQuerySchema,
  productIdParamSchema,
  updateThresholdSchema,
  variantIdParamSchema,
} from "../validators/inventory.validator.js";

/**
 * Router de /api/v1/admin/inventory. Sin superficie HTTP para reserve/commit:
 * no hay carrito ni webhook de pago que las dispare desde aquí — se prueban a
 * nivel de service y las conecta 1.5. `/reservations*` y `/products/:productId`
 * van ANTES de `/:variantId` para que Express no confunda esos segmentos con
 * un id de variante.
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
router.get(
  "/products/:productId",
  validate(productIdParamSchema, "params"),
  inventoryController.getProductDetail,
);
router.post("/", validate(createInventoryItemSchema), inventoryController.create);
router.get("/:variantId", validate(variantIdParamSchema, "params"), inventoryController.getOne);
router.patch(
  "/:variantId/stock",
  validate(variantIdParamSchema, "params"),
  validate(adjustStockSchema),
  inventoryController.adjustStock,
);
router.patch(
  "/:variantId",
  validate(variantIdParamSchema, "params"),
  validate(updateThresholdSchema),
  inventoryController.updateThreshold,
);

export { router as adminInventoryRoutes };
