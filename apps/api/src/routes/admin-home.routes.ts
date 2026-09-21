import { Router } from "express";
import { UserRole } from "@esencia-glow/shared";
import * as homeContentController from "../controllers/home-content.controller.js";
import * as homeImageController from "../controllers/home-image.controller.js";
import { validate } from "../middlewares/validate.js";
import { protect } from "../middlewares/protect.js";
import { restrictTo } from "../middlewares/restrict-to.js";
import { uploadRateLimiter } from "../middlewares/rate-limit.js";
import { uploadSingleImage } from "../middlewares/upload-image.js";
import { sanitizeMultipart } from "../middlewares/sanitize-multipart.js";
import {
  deleteImageQuerySchema,
  heroSlideImageParamsSchema,
  imageVersionBodySchema,
  updateAnnouncementSchema,
  updateBenefitsSchema,
  updateFeaturedCategoriesSchema,
  updateFeaturedProductsSchema,
  updateHeroSchema,
  updateSubscriptionPromoSchema,
  updateTestimonialsSchema,
} from "../validators/home-content.validator.js";

/**
 * Router de /api/v1/admin/home (Milestone 1.8). UN PUT por sección — nunca uno
 * que reemplace el documento entero (evita lost updates entre secciones). Cada
 * PUT lleva la `version` de su sección (409 si ya cambió). Como el resto de
 * las rutas admin de CRUD, sin rate limiter: auth + rol es la barrera; las de
 * imagen sí llevan `uploadRateLimiter` (el costo es CPU de `sharp`).
 *
 * Las imágenes son sub-recursos de su sección (hero: por slide y slot; promo
 * de suscripción): también piden `version` — en multipart como campo de
 * formulario, en el DELETE como query.
 */
const router = Router();

router.use(protect, restrictTo(UserRole.ADMIN));

router.get("/", homeContentController.get);
router.put("/announcement", validate(updateAnnouncementSchema), homeContentController.updateAnnouncement);
router.put("/hero", validate(updateHeroSchema), homeContentController.updateHero);
router.put(
  "/featured-products",
  validate(updateFeaturedProductsSchema),
  homeContentController.updateFeaturedProducts,
);
router.put(
  "/featured-categories",
  validate(updateFeaturedCategoriesSchema),
  homeContentController.updateFeaturedCategories,
);
router.put(
  "/subscription-promo",
  validate(updateSubscriptionPromoSchema),
  homeContentController.updateSubscriptionPromo,
);
router.put("/testimonials", validate(updateTestimonialsSchema), homeContentController.updateTestimonials);
router.put("/benefits", validate(updateBenefitsSchema), homeContentController.updateBenefits);

router.put(
  "/hero/slides/:slideId/images/:slot",
  uploadRateLimiter,
  validate(heroSlideImageParamsSchema, "params"),
  uploadSingleImage("image"),
  sanitizeMultipart,
  validate(imageVersionBodySchema),
  homeImageController.setHeroSlideImage,
);
router.delete(
  "/hero/slides/:slideId/images/:slot",
  validate(heroSlideImageParamsSchema, "params"),
  validate(deleteImageQuerySchema, "query"),
  homeImageController.removeHeroSlideImage,
);
router.put(
  "/subscription-promo/image",
  uploadRateLimiter,
  uploadSingleImage("image"),
  sanitizeMultipart,
  validate(imageVersionBodySchema),
  homeImageController.setPromoImage,
);
router.delete(
  "/subscription-promo/image",
  validate(deleteImageQuerySchema, "query"),
  homeImageController.removePromoImage,
);

export { router as adminHomeRoutes };
