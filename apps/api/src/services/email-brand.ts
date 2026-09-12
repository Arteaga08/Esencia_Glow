/**
 * Tokens de marca del shell de correo (§8 del plan de 1.6.3) — un solo
 * archivo, para que 2.0 ("System design") los reemplace por la paleta y el
 * logo finales sin tocar `email-layout.ts`. Provisionales a propósito: el
 * sistema de diseño de Esencia Glow todavía no existe (llega en Milestone
 * 2), así que el header lleva el nombre de la marca en texto en vez de un
 * logo — nunca una URL externa (un cliente de correo no es confiable para
 * ir a buscar un asset remoto, ver ECOMMERCE_ARCHITECTURE_GUIDELINES.md
 * §"Cómo se ve — correo"); cuando haya logo, va aquí como *data URI*.
 */
const EMAIL_BRAND_NAME = "Esencia Glow";

/** `undefined` hasta que 2.0 entregue un logo real — `email-layout.ts` cae
 * al nombre en texto cuando esto falta. */
const EMAIL_LOGO_DATA_URI: string | undefined = undefined;

const EMAIL_COLORS = {
  background: "#f4f1ee",
  cardBackground: "#ffffff",
  text: "#2b2b2b",
  muted: "#6b6b6b",
  accent: "#8a6d5c",
  accentText: "#ffffff",
  border: "#e5ddd6",
};

export { EMAIL_BRAND_NAME, EMAIL_LOGO_DATA_URI, EMAIL_COLORS };
