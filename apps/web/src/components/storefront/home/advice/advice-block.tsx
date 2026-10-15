import { getHomeContent } from "../../../../lib/storefront/home";
import { AdviceSection } from "./advice-section";

/**
 * Bloque de asesoría del home (donde iba el banner de oferta). Los textos y la
 * foto vienen del panel (Contenido del home); el API solo lo publica activo y
 * completo (foto, título, texto y botón). Sin eso, o si el API cae, no se pinta.
 */
async function AdviceBlock() {
  const home = await getHomeContent();
  if (!home?.advice) return null;
  return <AdviceSection advice={home.advice} />;
}

export { AdviceBlock };
