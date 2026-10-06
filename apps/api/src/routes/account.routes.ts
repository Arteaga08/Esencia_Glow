import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as accountController from "../controllers/account.controller.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { validate } from "../middlewares/validate.js";
import { accountWriteRateLimiter } from "../middlewares/rate-limit.js";
import {
  addWishlistItemSchema,
  addressParamSchema,
  billingInfoSchema,
  createAddressSchema,
  updateAddressSchema,
  updateProfileSchema,
  wishlistParamSchema,
} from "../validators/account.validator.js";

/**
 * `/api/v1/account` — recurso self-scoped por sesión (BACKEND_ARCHITECTURE_GUIDELINES.md §4):
 * `protect` una sola vez al tope, ninguna ruta lleva el id del dueño. Solo
 * clientas: un admin no tiene "Mi Cuenta" (su identidad vive en el panel).
 * Las escrituras comparten un limitador por usuaria.
 */
const router = Router();

router.use(protect, restrictTo(UserRole.CUSTOMER));

router.get("/", accountController.getAccount);
router.patch("/profile", accountWriteRateLimiter, validate(updateProfileSchema), accountController.updateProfile);

router.post("/addresses", accountWriteRateLimiter, validate(createAddressSchema), accountController.createAddress);
router.patch(
  "/addresses/:addressId",
  accountWriteRateLimiter,
  validate(addressParamSchema, "params"),
  validate(updateAddressSchema),
  accountController.updateAddress,
);
router.post(
  "/addresses/:addressId/default",
  accountWriteRateLimiter,
  validate(addressParamSchema, "params"),
  accountController.setDefaultAddress,
);
router.delete(
  "/addresses/:addressId",
  accountWriteRateLimiter,
  validate(addressParamSchema, "params"),
  accountController.deleteAddress,
);

router.put("/billing-info", accountWriteRateLimiter, validate(billingInfoSchema), accountController.saveBillingInfo);
router.delete("/billing-info", accountWriteRateLimiter, accountController.deleteBillingInfo);

router.get("/wishlist", accountController.listWishlist);
router.post("/wishlist", accountWriteRateLimiter, validate(addWishlistItemSchema), accountController.addWishlistItem);
router.delete(
  "/wishlist/:itemType/:itemId",
  accountWriteRateLimiter,
  validate(wishlistParamSchema, "params"),
  accountController.removeWishlistItem,
);

export { router as accountRoutes };
