import { getHomeBrands } from "../../../../lib/storefront/brands";
import { BrandMarqueeSection } from "./brand-marquee-section";

/**
 * Cinta de marcas bajo el hero. Las marcas son las que la clienta marcó
 * "Mostrar en el home" en el panel; sin ninguna (o con el API caído) no se pinta.
 */
async function BrandMarqueeBlock() {
  const brands = await getHomeBrands();
  if (brands.length === 0) return null;
  return <BrandMarqueeSection brands={brands} />;
}

export { BrandMarqueeBlock };
