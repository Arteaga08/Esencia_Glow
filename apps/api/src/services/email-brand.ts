/**
 * Tokens de marca del shell de correo — un solo archivo para que el logo
 * final entre sin tocar `email-layout.ts`. Son los OKLCH de `DESIGN.md`
 * convertidos a hex y copiados por valor: un cliente de correo no resuelve
 * variables CSS ni `@theme` (ECOMMERCE_ARCHITECTURE_GUIDELINES.md, "Cómo se
 * ve — correo"). Los pares de texto sobre fondo se midieron contra WCAG AA.
 *
 * El header lleva el nombre de la marca en texto hasta que haya logo; cuando
 * exista, va aquí como *data URI*, nunca como una URL externa.
 */
const EMAIL_BRAND_NAME = "Esencia Glow";

/** `undefined` hasta que Manuel entregue el logo — `email-layout.ts` cae al nombre en texto. */
const EMAIL_LOGO_DATA_URI: string | undefined = undefined;

const EMAIL_COLORS = {
  /** Lienzo de página (`background`). */
  canvas: "#fff9fb",
  surface: "#ffffff",
  /** Tinta, texto principal (`foreground`): 9.3:1 sobre blanco. */
  ink: "#5d4037",
  /** Texto secundario (`muted-foreground-strong`): 6.1:1 sobre blanco. */
  muted: "#785a63",
  /** Rosa Bitácora (`primary`): fondo del botón, siempre con tinta encima (5.7:1). */
  rose: "#ffb7c5",
  /** Rosa Acción (`primary-action`): borde del botón y de acentos. */
  roseAction: "#9f5f6d",
  roseSoft: "#ffdde4",
  mint: "#b2e2d2",
  mintText: "#2d4a3e",
  butter: "#fff0c2",
  butterText: "#816829",
  border: "#ffe1e9",
  borderStrong: "#a58a91",
} as const;

/**
 * Schibsted Grotesk y PT Mono solo se ven si la clienta los tiene instalados
 * (un correo no descarga fuentes web de forma confiable); la pila cae a
 * Helvetica/Arial y Courier, que conservan el contraste de voz.
 */
const EMAIL_FONTS = {
  sans: "'Schibsted Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif",
  mono: "'PT Mono','Courier New',Courier,monospace",
} as const;

export { EMAIL_BRAND_NAME, EMAIL_LOGO_DATA_URI, EMAIL_COLORS, EMAIL_FONTS };
