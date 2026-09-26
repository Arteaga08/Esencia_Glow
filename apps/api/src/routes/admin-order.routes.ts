import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as orderAdminController from "../controllers/order-admin.controller.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { validate } from "../middlewares/validate.js";
import { refundRateLimiter } from "../middlewares/rate-limit.js";
import { objectIdParamSchema } from "../validators/media.validator.js";
import {
  addInternalNoteSchema,
  bulkChangeStatusSchema,
  changeOrderPrioritySchema,
  changeOrderStatusSchema,
  correctShippingAddressSchema,
  listAdminOrdersQuerySchema,
  refundOrderSchema,
  updateOrderShipmentSchema,
} from "../validators/order-admin.validator.js";

/**
 * `/api/v1/admin/orders`. `/summary` y `/bulk-status` se montan ANTES que
 * `/:id` — mismo motivo que `admin-inventory.routes.ts` monta
 * `/reservations` antes que `/:variantId`: si no, Express intentaría leer
 * "summary"/"bulk-status" como un `:id` y `objectIdParamSchema` los
 * rechazaría con 400 antes de llegar a la ruta correcta.
 */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/summary", orderAdminController.summary);
router.post(
  "/bulk-status",
  validate(bulkChangeStatusSchema),
  orderAdminController.bulkStatus,
);
router.get("/", validate(listAdminOrdersQuerySchema, "query"), orderAdminController.list);
router.get("/:id", validate(objectIdParamSchema, "params"), orderAdminController.getOne);
router.get("/:id/tracking", validate(objectIdParamSchema, "params"), orderAdminController.tracking);
router.get("/:id/activity", validate(objectIdParamSchema, "params"), orderAdminController.activity);
router.get("/:id/notes", validate(objectIdParamSchema, "params"), orderAdminController.notes);
router.patch(
  "/:id/status",
  validate(objectIdParamSchema, "params"),
  validate(changeOrderStatusSchema),
  orderAdminController.changeStatus,
);
router.patch(
  "/:id/shipment",
  validate(objectIdParamSchema, "params"),
  validate(updateOrderShipmentSchema),
  orderAdminController.updateShipment,
);
router.patch(
  "/:id/shipping-address",
  validate(objectIdParamSchema, "params"),
  validate(correctShippingAddressSchema),
  orderAdminController.correctAddress,
);
router.patch(
  "/:id/priority",
  validate(objectIdParamSchema, "params"),
  validate(changeOrderPrioritySchema),
  orderAdminController.changePriority,
);
router.post(
  "/:id/notes",
  validate(objectIdParamSchema, "params"),
  validate(addInternalNoteSchema),
  orderAdminController.addNote,
);
router.post(
  "/:id/refund",
  validate(objectIdParamSchema, "params"),
  refundRateLimiter,
  validate(refundOrderSchema),
  orderAdminController.refund,
);
router.post("/:id/label/retry", validate(objectIdParamSchema, "params"), orderAdminController.retryLabel);

export { router as adminOrderRoutes };
