import { CheckCircle, Flask, Heart, Sparkle } from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { ContentKey } from "@/lib/storefront/product-view";

/** Un icono por bloque de contenido, como en el acordeón de la referencia. */
const CONTENT_ICONS: Record<ContentKey, Icon> = {
  benefits: Sparkle,
  routineSteps: Heart,
  usage: CheckCircle,
  ingredients: Flask,
};

export { CONTENT_ICONS };
