import { HomeSectionKey, type HomeSpotlightKey } from "@esencia-glow/shared";

/** Segmento de URL de las rutas admin → clave de la sección en el singleton del home. */
const SPOTLIGHT_BY_SLUG: Record<string, HomeSpotlightKey> = {
  "new-arrivals": HomeSectionKey.NEW_ARRIVALS,
  kits: HomeSectionKey.KITS,
};

export { SPOTLIGHT_BY_SLUG };
