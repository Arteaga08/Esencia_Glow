import { Schema, model, type HydratedDocument, type Model } from "mongoose";
import {
  announcementSchema,
  benefitsSchema,
  featuredCategoriesSchema,
  featuredProductsSchema,
  heroSchema,
  subscriptionPromoSchema,
  testimonialsSchema,
  type HomeAnnouncementAttrs,
  type HomeBenefitsAttrs,
  type HomeFeaturedCategoriesAttrs,
  type HomeFeaturedProductsAttrs,
  type HomeHeroAttrs,
  type HomeSubscriptionPromoAttrs,
  type HomeTestimonialsAttrs,
} from "./home-section.schemas.js";

/**
 * Singleton del contenido del home (Milestone 1.8), `_id` fijo ("home").
 * Colección propia y no una clave de Settings: Settings es configuración de
 * negocio solo para admin; esto es contenido público que la lectura anónima
 * sirve, y no deben compartir documento.
 *
 * Cada sección es un subdocumento con su propio `version`. Toda escritura es
 * un `findOneAndUpdate` con `$set` de rutas de punto de UNA sola sección,
 * condicionado a la versión que el admin leyó (home-content-store.ts): dos
 * ediciones en secciones distintas nunca se pisan, y en la misma sección la
 * segunda recibe 409 en vez de sobrescribir en silencio.
 */
interface HomeContentAttrs {
  _id: string;
  announcement?: HomeAnnouncementAttrs;
  hero?: HomeHeroAttrs;
  featuredProducts?: HomeFeaturedProductsAttrs;
  featuredCategories?: HomeFeaturedCategoriesAttrs;
  subscriptionPromo?: HomeSubscriptionPromoAttrs;
  testimonials?: HomeTestimonialsAttrs;
  benefits?: HomeBenefitsAttrs;
}

type HomeContentDocument = HydratedDocument<HomeContentAttrs>;
type HomeContentModel = Model<HomeContentAttrs>;

const homeContentSchema = new Schema<HomeContentAttrs, HomeContentModel>(
  {
    _id: { type: String },
    announcement: { type: announcementSchema },
    hero: { type: heroSchema },
    featuredProducts: { type: featuredProductsSchema },
    featuredCategories: { type: featuredCategoriesSchema },
    subscriptionPromo: { type: subscriptionPromoSchema },
    testimonials: { type: testimonialsSchema },
    benefits: { type: benefitsSchema },
  },
  { timestamps: true },
);

const HomeContent = model<HomeContentAttrs, HomeContentModel>("HomeContent", homeContentSchema);

export { HomeContent };
export type { HomeContentAttrs, HomeContentDocument };
