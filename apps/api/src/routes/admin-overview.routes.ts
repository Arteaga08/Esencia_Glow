import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as overviewController from "../controllers/overview.controller.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { validate } from "../middlewares/validate.js";
import { overviewSalesQuerySchema } from "../validators/overview.validator.js";

/**
 * `/api/v1/admin/overview` (Milestone 2.9) — solo lectura, la única sección
 * "propia" del Resumen del panel: el resto de las tarjetas componen
 * endpoints ya existentes de cada módulo (pedidos, envíos, inventario,
 * suscripciones), sin ruta nueva.
 */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/sales", validate(overviewSalesQuerySchema, "query"), overviewController.sales);

export { router as adminOverviewRoutes };
