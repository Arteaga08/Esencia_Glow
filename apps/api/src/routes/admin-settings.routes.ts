import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as settingsController from "../controllers/settings.controller.js";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { updateInventorySettingsSchema } from "../validators/settings.validator.js";

const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/", settingsController.get);
router.patch("/inventory", validate(updateInventorySettingsSchema), settingsController.updateInventory);

export { router as adminSettingsRoutes };
